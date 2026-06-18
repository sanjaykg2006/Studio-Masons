"use server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { requireRole, getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/app/generated/prisma";

export type Profile = { name: string; email: string; role: string; avatarUrl: string | null };
export type TeamMember = Profile & { id: string; status: "Active" | "Invited"; team: string | null };

// The currently logged-in user's own profile (name/email/role from the DB row).
export async function getMyProfile(): Promise<Profile | null> {
  try {
    const user = await getCurrentUser();
    if (!user) return null;
    return { name: user.name, email: user.email, role: user.role, avatarUrl: user.avatarUrl };
  } catch (err) {
    // Surface the real cause (e.g. missing/incorrect DATABASE_URL) in the
    // server / Vercel function logs, then let the client show its error state.
    console.error("[getMyProfile] failed:", err);
    throw err;
  }
}

// All provisioned team members, with login status derived from Supabase Auth
// (Active = has confirmed/signed in; Invited = invite not yet accepted).
export async function listTeam(): Promise<TeamMember[]> {
  const me = await getCurrentUser();
  if (!me) return [];

  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });

  let adminOk = false;
  const confirmed = new Map<string, boolean>();
  try {
    const { data, error } = await createAdminClient().auth.admin.listUsers({ perPage: 1000 });
    if (!error) {
      adminOk = true;
      for (const u of data.users) {
        confirmed.set(u.id, Boolean(u.last_sign_in_at || u.email_confirmed_at));
      }
    }
  } catch {
    // If we can't reach the admin API, fall back to showing everyone as Active.
  }

  return users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    avatarUrl: u.avatarUrl,
    team: u.team,
    status: !adminOk || (u.supabaseId && confirmed.get(u.supabaseId)) ? "Active" : "Invited",
  }));
}

// Admin-only: tag a member's design sub-team (Concept | Project | Site). Drives
// the Project Tracker lead/helper pickers. An empty value clears the tag.
export async function updateMemberTeam(userId: string, team: string): Promise<ActionResult> {
  try {
    await requireRole(["ADMIN"]);
  } catch {
    return { ok: false, error: "Only admins can change teams." };
  }
  await prisma.user.update({ where: { id: userId }, data: { team: team || null } });
  return { ok: true };
}

// Builds a link that points at our own /auth/confirm route (token_hash flow),
// which verifies the user and forwards them to /set-password.
function confirmLink(siteUrl: string, tokenHash: string, type: "invite" | "recovery") {
  return `${siteUrl}/auth/confirm?token_hash=${tokenHash}&type=${type}&next=${encodeURIComponent("/set-password")}`;
}

export type InviteResult = { ok: true; link?: string } | { ok: false; error: string };

// Admin-only: sends a Supabase invite email and provisions the matching Prisma
// User row (with role). The invited user clicks the email link, which hits
// /auth/confirm (token_hash verification), then /set-password to pick a password.
export async function inviteUser(formData: FormData): Promise<InviteResult> {
  try {
    await requireRole(["ADMIN"]);
  } catch {
    return { ok: false, error: "Only admins can invite members." };
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "") as Role;

  if (!email || !name || !role) {
    return { ok: false, error: "Name, email and role are required." };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { ok: false, error: "A user with that email already exists." };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const admin = createAdminClient();

  // Supabase sends the invite email using the "Invite user" template.
  // That template must point its link at /auth/confirm with the token_hash
  // (see the dashboard setup), otherwise the link can't be verified.
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${siteUrl}/auth/confirm?next=/set-password`,
  });

  if (error || !data.user) {
    return { ok: false, error: error?.message ?? "Failed to send invite." };
  }

  await prisma.user.create({
    data: { supabaseId: data.user.id, email, name, role },
  });

  // Supabase's email delivery is best-effort (shared SMTP is rate-limited and
  // often blocked by recipient domains), so the invite email may never arrive.
  // Also generate a registration link the admin can share directly through any
  // channel — this makes the invite work regardless of email deliverability.
  let link: string | undefined;
  try {
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: `${siteUrl}/auth/confirm?type=recovery&next=/set-password` },
    });
    if (!linkErr && linkData.properties) {
      link = confirmLink(siteUrl, linkData.properties.hashed_token, "recovery");
    }
  } catch {
    // Link generation is a convenience on top of the email; ignore failures.
  }

  return { ok: true, link };
}

export type LinkResult = { ok: true; link: string } | { ok: false; error: string };

// Admin-only: regenerates a fresh registration / password link for an existing
// member (e.g. their first link expired). Works whether or not they've already
// set a password — it always lets them (re)set it on /set-password.
export async function createInviteLink(userId: string): Promise<LinkResult> {
  try {
    await requireRole(["ADMIN"]);
  } catch {
    return { ok: false, error: "Only admins can do that." };
  }

  const member = await prisma.user.findUnique({ where: { id: userId } });
  if (!member) return { ok: false, error: "Member not found." };

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: member.email,
    options: { redirectTo: `${siteUrl}/auth/confirm?type=recovery&next=/set-password` },
  });

  if (error || !data.properties) {
    return { ok: false, error: error?.message ?? "Failed to create link." };
  }

  return { ok: true, link: confirmLink(siteUrl, data.properties.hashed_token, "recovery") };
}

export type ActionResult = { ok: true } | { ok: false; error: string };

// Admin-only: change a member's role.
export async function updateRole(userId: string, role: Role): Promise<ActionResult> {
  try {
    await requireRole(["ADMIN"]);
  } catch {
    return { ok: false, error: "Only admins can change roles." };
  }
  await prisma.user.update({ where: { id: userId }, data: { role } });
  return { ok: true };
}

// Admin-only: remove a member from the workspace (deletes the Prisma row and
// the Supabase auth user). Fails cleanly if the member still owns records.
export async function removeMember(userId: string): Promise<ActionResult> {
  let me;
  try {
    me = await requireRole(["ADMIN"]);
  } catch {
    return { ok: false, error: "Only admins can remove members." };
  }
  if (me.id === userId) {
    return { ok: false, error: "You can't remove your own account." };
  }

  const member = await prisma.user.findUnique({ where: { id: userId } });
  if (!member) return { ok: false, error: "Member not found." };

  if (member.supabaseId) {
    try {
      await createAdminClient().auth.admin.deleteUser(member.supabaseId);
    } catch {
      // Ignore — auth user may already be gone; still remove the DB row below.
    }
  }

  try {
    await prisma.user.delete({ where: { id: userId } });
  } catch {
    return { ok: false, error: "Can't remove — this member still owns project records." };
  }

  return { ok: true };
}

const AVATAR_BUCKET = "avatars";

export type AvatarResult = { ok: true; url: string } | { ok: false; error: string };

// Uploads the logged-in user's profile photo to Supabase Storage (service-role,
// so no bucket RLS policy is required) and saves the public URL on their row.
export async function uploadAvatar(formData: FormData): Promise<AvatarResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "No file provided." };
  }
  if (!file.type.startsWith("image/")) {
    return { ok: false, error: "Please choose an image file." };
  }
  if (file.size > 2 * 1024 * 1024) {
    return { ok: false, error: "Image must be under 2 MB." };
  }

  const admin = createAdminClient();

  // First upload creates the public bucket; later calls return an "already
  // exists" error which we can safely ignore.
  await admin.storage.createBucket(AVATAR_BUCKET, { public: true });

  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const path = `${user.id}-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await admin.storage
    .from(AVATAR_BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: true });
  if (upErr) return { ok: false, error: upErr.message };

  const { data } = admin.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  await prisma.user.update({ where: { id: user.id }, data: { avatarUrl: data.publicUrl } });

  return { ok: true, url: data.publicUrl };
}

// Clears the logged-in user's profile photo.
export async function removeAvatar(): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  await prisma.user.update({ where: { id: user.id }, data: { avatarUrl: null } });
  return { ok: true };
}

// Changes the logged-in user's password. Verifies the current password first
// (via a throwaway sign-in that doesn't touch the live session), then updates
// it with the admin client — which avoids the client-side reauthentication /
// "secure password change" requirement that blocks supabase.auth.updateUser().
export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || !user.supabaseId) return { ok: false, error: "Not authenticated." };
  if (newPassword.length < 8) {
    return { ok: false, error: "New password must be at least 8 characters." };
  }

  const email = user.authEmail ?? user.email;

  const verifier = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { error: authErr } = await verifier.auth.signInWithPassword({
    email,
    password: currentPassword,
  });
  if (authErr) return { ok: false, error: "Current password is incorrect." };

  const { error } = await createAdminClient().auth.admin.updateUserById(user.supabaseId, {
    password: newPassword,
  });
  if (error) return { ok: false, error: error.message };

  return { ok: true };
}
