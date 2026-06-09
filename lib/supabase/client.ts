import { createBrowserClient } from "@supabase/ssr";

// Supabase client for Client Components (browser). Keeps the auth cookies in
// sync with the server so middleware can read the session.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
