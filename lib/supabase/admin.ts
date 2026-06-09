import { createClient } from "@supabase/supabase-js";

// Privileged Supabase client using the service-role key. SERVER-ONLY.
// Never import this into a Client Component — it can bypass all RLS and
// perform admin actions like inviting users.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
