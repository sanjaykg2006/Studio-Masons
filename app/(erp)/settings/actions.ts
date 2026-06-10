"use server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole, getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/app/generated/prisma";

export type Profile = { name: string; email: string; role: string };
export type TeamMember = Profile & { id: string; status: "Active" | "Invited" };

// The currently logged-in user's own profile (name/email/role from the DB row).
export async function getMyProfile(): Promise<Profile | null> {
  try {
    const user = await getCurrentUser();
    if (!user) return null;
    return { name: user.name, email: user.email, role: user.role };
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
    status: !adminOk || (u.supabaseId && confirmed.get(u.supabaseId)) ? "Active" : "Invited",
  }));
}

// Builds a link that points at our own /auth/confirm route (token_hash flow),
// which verifies the user and forwards them to /set-password.
function confirmLink(siteUrl: string, tokenHash: string, type: "invite" | "recovery") {
  return `${siteUrl}/auth/confirm?token_hash=${tokenHash}&type=${type}&next=${encodeURIComponent("/set-password")}`;
}

export type InviteResult = { ok: true } | { ok: false; error: string };

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

  return { ok: true };
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
