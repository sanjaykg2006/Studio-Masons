import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import type { Role, User } from "@/app/generated/prisma";

export type CurrentUser = User & { authEmail: string | undefined };

// Returns the logged-in user joined with their Prisma row (which holds `role`),
// or null if not authenticated / not provisioned. Authorization lives here, in
// your own DB — Supabase only proves identity.
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const dbUser = await prisma.user.findUnique({
    where: { supabaseId: user.id },
  });
  if (!dbUser) return null;

  return { ...dbUser, authEmail: user.email };
}

// Throws if the user is missing or lacks one of the allowed roles.
// Use at the top of Server Actions / Route Handlers that need protection.
export async function requireRole(allowed: Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  if (!allowed.includes(user.role)) throw new Error("Forbidden: insufficient role");
  return user;
}
