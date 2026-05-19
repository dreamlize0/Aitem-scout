// Supabase client factories for edge functions.
//   getServiceClient(): bypasses RLS — use for caches, logs, share lookups.
//   getUserClient(req): forwards the caller's JWT — RLS-enforced reads/writes.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { requireEnv } from "./env.ts";

export function getServiceClient(): SupabaseClient {
  return createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export function getUserClient(req: Request): SupabaseClient {
  const authHeader = req.headers.get("Authorization") ?? "";
  return createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_ANON_KEY"),
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authHeader } },
    },
  );
}
