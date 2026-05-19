"use client";

import { Sparkles, Mail, AlertTriangle, Loader2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { getSupabase, isSupabaseConfigured, SITE_URL } from "@/lib/supabase";

type Provider = "google" | "github";

function GithubMark({ className }: { className?: string }) {
  // Brand icons were removed from lucide-react v1, inline SVG instead.
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55v-1.93c-3.2.69-3.87-1.54-3.87-1.54-.52-1.33-1.27-1.68-1.27-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.24 3.34.95.1-.74.4-1.24.73-1.53-2.55-.29-5.23-1.27-5.23-5.66 0-1.25.45-2.27 1.18-3.07-.12-.29-.51-1.45.11-3.02 0 0 .96-.31 3.15 1.17a10.95 10.95 0 0 1 5.73 0c2.19-1.48 3.15-1.17 3.15-1.17.62 1.57.23 2.73.11 3.02.73.8 1.18 1.82 1.18 3.07 0 4.4-2.69 5.36-5.25 5.65.41.35.78 1.04.78 2.1v3.11c0 .3.21.66.8.55C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z" />
    </svg>
  );
}

function LoginPageInner() {
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const urlError = params.get("error");

  const [pending, setPending] = useState<Provider | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleOAuth = async (provider: Provider) => {
    setLocalError(null);
    const supabase = getSupabase();
    if (!supabase) {
      setLocalError("Supabase 환경변수가 설정되지 않아 OAuth를 사용할 수 없습니다.");
      return;
    }
    setPending(provider);

    const origin = SITE_URL || (typeof window !== "undefined" ? window.location.origin : "");
    const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
    if (error) {
      setPending(null);
      setLocalError(error.message);
    }
    // On success Supabase navigates the window to the provider — nothing more to do.
  };

  const errorMessage = localError ?? urlError ?? null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-background)] p-6">
      <div className="w-full max-w-md bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-[var(--color-primary)]/20 blur-3xl rounded-full" />

        <div className="relative text-center space-y-6">
          <Link
            href="/"
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--color-surface-hover)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/50 transition-colors"
          >
            <Sparkles className="w-8 h-8 text-[var(--color-primary)]" />
          </Link>

          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-white tracking-tight">로그인</h1>
            <p className="text-[var(--color-muted)]">AItem Scout에 오신 것을 환영합니다.</p>
          </div>

          {!isSupabaseConfigured && (
            <div className="text-xs text-amber-300/90 bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2 text-left flex gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                <code className="font-mono">.env.local</code>에 <code>NEXT_PUBLIC_SUPABASE_URL</code>{" "}
                / <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>를 설정하면 OAuth가 활성화됩니다.
              </span>
            </div>
          )}

          {errorMessage && (
            <div className="text-xs text-red-300 bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2 text-left break-words">
              {errorMessage}
            </div>
          )}

          <div className="space-y-4 pt-2">
            <button
              type="button"
              onClick={() => handleOAuth("google")}
              disabled={!isSupabaseConfigured || pending !== null}
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-black px-4 py-3.5 rounded-xl font-bold transition-colors"
            >
              {pending === "google" ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
              )}
              Google 계정으로 계속
            </button>

            <button
              type="button"
              onClick={() => handleOAuth("github")}
              disabled={!isSupabaseConfigured || pending !== null}
              className="w-full flex items-center justify-center gap-3 bg-[#24292F] hover:bg-[#1F2428] disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-3.5 rounded-xl font-bold transition-colors"
            >
              {pending === "github" ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <GithubMark className="w-5 h-5" />
              )}
              GitHub 계정으로 계속
            </button>

            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[var(--color-border)]"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-[var(--color-surface)] text-[var(--color-muted)]">또는</span>
              </div>
            </div>

            <button
              type="button"
              disabled
              title="이메일 로그인은 다음 단계에서 추가됩니다"
              className="w-full flex items-center justify-center gap-3 border border-[var(--color-border)] disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-3.5 rounded-xl font-bold transition-colors"
            >
              <Mail className="w-5 h-5 text-[var(--color-muted)]" />
              이메일로 로그인 (준비 중)
            </button>
          </div>

          <div className="pt-4 text-sm text-[var(--color-muted)]">
            OAuth로 처음 로그인하면 자동으로 계정이 생성됩니다.
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  // useSearchParams must be wrapped in Suspense in Next App Router.
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}
