// Per-request proxy (renamed from middleware in Next 16): keeps the Supabase
// auth cookies fresh and gates the user-specific pages (/storage) behind login.
//
// Public routes (/, /login, /shared/*, /auth/*) stay accessible to anyone — the
// hero state and shared viewer should be reachable without auth.

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PROTECTED_PREFIXES = ["/storage", "/settings"];

export async function proxy(request: NextRequest) {
  const url = request.nextUrl;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  // No supabase = no auth-aware behaviour, just pass through. This keeps the UI
  // dev flow working when env vars aren't set.
  if (!supabaseUrl || !supabaseAnonKey) return NextResponse.next();

  const response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value, options }) => {
          response.cookies.set({ name, value, ...options });
        });
      },
    },
  });

  // Refreshes the access token cookie if needed.
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch (err) {
    // Transient auth-check failure (network blip, supabase reachability,
    // expired-but-unrefreshable cookie). RLS on the backend still guards data,
    // so let the request through — the page's useAuth hook will reconcile once
    // the network recovers. Returning a 500 here would take down every page.
    console.warn("[proxy] auth check failed, passing through:", err);
    return response;
  }

  const requiresAuth = PROTECTED_PREFIXES.some((p) => url.pathname.startsWith(p));
  if (requiresAuth && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", url.pathname + url.search);
    return NextResponse.redirect(loginUrl);
  }

  // If a signed-in user lands on /login, bounce them to ?next (when same-origin)
  // or /. Without this they see the OAuth screen even though their session is
  // already valid, which is a confusing dead-end.
  if (url.pathname === "/login" && user) {
    const nextParam = url.searchParams.get("next");
    const safeNext =
      nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";
    return NextResponse.redirect(new URL(safeNext, request.url));
  }

  return response;
}

export const config = {
  // Run on every request except static assets and image optimizer paths.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
