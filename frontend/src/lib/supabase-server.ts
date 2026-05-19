// Server-side Supabase client — used by route handlers (e.g. /auth/callback)
// and any future Server Components that need to read the user's session.
//
// We DO NOT export this from a module shared with client code, since `cookies()`
// is server-only. Importing this file from a client component will fail at build.

import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./supabase";

export async function getServerSupabase(): Promise<SupabaseClient | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;

  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        // In Route Handlers and Server Actions cookieStore is writable; in
        // pure Server Components it isn't. Swallow the error in the latter case.
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          /* read-only context — middleware will refresh the cookie on next request */
        }
      },
    },
  });
}
