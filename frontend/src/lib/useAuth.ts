"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "./supabase";
import type { User } from "@supabase/supabase-js";

interface AuthState {
  user: User | null;
  loading: boolean;
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      setState({ user: null, loading: false });
      return;
    }

    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (mounted) setState({ user: data.user ?? null, loading: false });
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setState({ user: session?.user ?? null, loading: false });
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}

export async function signOut(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.auth.signOut();
}
