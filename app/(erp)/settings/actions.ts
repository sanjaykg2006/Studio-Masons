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

export type InviteResult = { ok: true } | { ok: false; error: string };

// Admin-only: sends a Supabase invite email and provisions the matching
// Prisma User row (with role). The invited user clicks the email link, lands
// on /auth/callback, then /set-password to choose their password.
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

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${siteUrl}/auth/callback?next=/set-password`,
  });

  if (error || !data.user) {
    return { ok: false, error: error?.message ?? "Failed to send invite." };
  }

  await prisma.user.create({
    data: { supabaseId: data.user.id, email, name, role },
  });

  return { ok: true };
}
