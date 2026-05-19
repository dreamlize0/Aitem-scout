// Browser-side Supabase client singleton built on @supabase/ssr so the auth
// cookies it writes are the ones our middleware/server helpers can read.
//
// When env vars are missing we return null so callers can fall back to mock
// data (see src/store/useSearchStore.ts) or show a friendly "not configured"
// message in auth UIs.

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (typeof window !== "undefined" ? window.location.origin : "");

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!client) {
    client = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return client;
}
