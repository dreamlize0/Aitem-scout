// OAuth + magic-link callback.
// Supabase redirects here with ?code=… after the provider hands the user back.
// We exchange the code for a session (which writes the auth cookies) and then
// redirect to ?next or /.

import { NextResponse, type NextRequest } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/";
  const errorParam = url.searchParams.get("error_description") || url.searchParams.get("error");

  if (errorParam) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(errorParam)}`, url.origin),
    );
  }

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", url.origin));
  }

  const supabase = await getServerSupabase();
  if (!supabase) {
    return NextResponse.redirect(new URL("/login?error=not_configured", url.origin));
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin),
    );
  }

  // Ensure `next` is a same-origin path to prevent open-redirect.
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  return NextResponse.redirect(new URL(safeNext, url.origin));
}
