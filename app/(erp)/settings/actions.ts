"use server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/app/generated/prisma";

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
