import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Routes reachable without being logged in.
const PUBLIC_PREFIXES = ["/login", "/set-password", "/auth"];

function isPublic(pathname: string) {
  return PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p + "?")
  );
}

// Readable response when the app is misconfigured, instead of an opaque
// MIDDLEWARE_INVOCATION_FAILED 500 from the host.
function configErrorResponse(missing: string[]) {
  const body =
    "Server configuration error\n\n" +
    "The app is missing required environment variables:\n" +
    missing.map((m) => "  - " + m).join("\n") +
    "\n\nSet them in your hosting provider (e.g. Vercel -> Settings -> " +
    "Environment Variables) and redeploy.";
  return new NextResponse(body, {
    status: 500,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

// Refreshes the Supabase session on every request and enforces auth:
// unauthenticated users are sent to /login, logged-in users are kept off /login.
export async function updateSession(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Fail loudly but clearly if the deployment is missing Supabase config,
  // rather than throwing an opaque error inside createServerClient.
  const missing: string[] = [];
  if (!supabaseUrl) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!supabaseKey) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (missing.length > 0) {
    console.error(`[middleware] Missing required env vars: ${missing.join(", ")}`);
    return configErrorResponse(missing);
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl!, supabaseKey!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // IMPORTANT: do not run code between createServerClient and getUser().
  // If the auth service is briefly unreachable, fail safe (treat as logged
  // out) instead of crashing every route with a 500.
  let user = null;
  try {
    const result = await supabase.auth.getUser();
    user = result.data.user;
  } catch (err) {
    console.error("[middleware] Failed to verify session:", err);
  }

  const { pathname } = request.nextUrl;

  if (!user && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && (pathname === "/login" || pathname.startsWith("/login/"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
