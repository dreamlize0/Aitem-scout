// Extract and verify the caller's auth identity via the user-scoped client.

import { getUserClient } from "./supabase.ts";

export interface AuthIdentity {
  userId: string;
  email: string | null;
}

export async function requireUser(req: Request): Promise<AuthIdentity> {
  const client = getUserClient(req);
  const { data, error } = await client.auth.getUser();
  if (error || !data?.user) {
    throw new AuthError("Sign-in required");
  }
  return { userId: data.user.id, email: data.user.email ?? null };
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}
