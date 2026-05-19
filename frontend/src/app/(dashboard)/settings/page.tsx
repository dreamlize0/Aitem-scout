"use client";

import { useEffect, useState } from "react";
import {
  Settings as SettingsIcon,
  User,
  Briefcase,
  Plug,
  CreditCard,
  LogOut,
  CheckCircle2,
  Circle,
  Sparkles,
  Mail,
  AlertTriangle,
  Loader2,
  XCircle,
  Clock,
} from "lucide-react";
import { isSupabaseConfigured } from "@/lib/api";
import { signOut, useAuth } from "@/lib/useAuth";
import { useSearchStore } from "@/store/useSearchStore";
import type { ConnectorFailure } from "@/lib/types";

interface ConnectorStatus {
  name: string;
  label: string;
  envHint: string;
}

const CONNECTOR_STATUSES: ConnectorStatus[] = [
  { name: "naver", label: "네이버 (블로그/검색)", envHint: "NAVER_CLIENT_ID / NAVER_CLIENT_SECRET" },
  { name: "kakao", label: "카카오", envHint: "KAKAO_REST_API_KEY" },
  { name: "youtube", label: "YouTube", envHint: "YOUTUBE_API_KEY" },
  { name: "google_trends", label: "Google Trends", envHint: "SERPAPI_KEY (선택)" },
  { name: "meta", label: "Instagram (해시태그)", envHint: "META_ACCESS_TOKEN + META_IG_BUSINESS_ID" },
  { name: "threads", label: "Threads", envHint: "THREADS_ACCESS_TOKEN" },
  { name: "x", label: "X (Twitter)", envHint: "X_BEARER_TOKEN" },
  { name: "tavily", label: "웹 보조 검색", envHint: "TAVILY_API_KEY (선택)" },
];

type ConnectorRunState =
  | { kind: "unknown" }
  | { kind: "succeeded" }
  | { kind: "failed"; failure: ConnectorFailure };

function displayNameOf(user: { email?: string | null; user_metadata?: Record<string, unknown> }) {
  const meta = user.user_metadata ?? {};
  return (
    (meta["full_name"] as string | undefined) ??
    (meta["display_name"] as string | undefined) ??
    (user.email ? user.email.split("@")[0] : "사용자")
  );
}

// Coarse "N분 전" formatter — good enough for a sync recency hint, no i18n lib.
function formatRelative(ts: number, now: number): string {
  const diffSec = Math.max(0, Math.round((now - ts) / 1000));
  if (diffSec < 60) return "방금 전";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  const diffDay = Math.round(diffHour / 24);
  return `${diffDay}일 전`;
}

export default function SettingsPage() {
  const { user, loading } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const response = useSearchStore((s) => s.response);
  const lastSearchedAt = useSearchStore((s) => s.lastSearchedAt);

  // Re-tick once a minute so the relative timestamp doesn't go stale while the
  // settings page stays open. Cheap; the page is small.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (lastSearchedAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [lastSearchedAt]);

  const succeededSet = new Set(response?.connectors.succeeded ?? []);
  const failedByName = new Map<string, ConnectorFailure>();
  for (const f of response?.connectors.failed ?? []) failedByName.set(f.name, f);

  const stateFor = (name: string): ConnectorRunState => {
    if (!response) return { kind: "unknown" };
    const failure = failedByName.get(name);
    if (failure) return { kind: "failed", failure };
    if (succeededSet.has(name)) return { kind: "succeeded" };
    return { kind: "unknown" };
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      // useAuth 구독으로 user=null로 갱신됨. proxy.ts가 /settings를 보호하므로
      // 다음 요청에 /login으로 리다이렉트.
      window.location.href = "/login";
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <>
      <header className="h-16 border-b border-[var(--color-border)] bg-[var(--color-background)]/80 backdrop-blur-sm flex items-center justify-between px-8 sticky top-0 z-10 shrink-0">
        <div className="flex items-center gap-2 font-bold text-lg">
          <SettingsIcon className="w-5 h-5 text-[var(--color-primary)]" />
          설정
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-8 space-y-6">
          {loading && (
            <div className="flex items-center justify-center py-16 text-[var(--color-muted)]">
              <Loader2 className="w-6 h-6 animate-spin text-[var(--color-primary)]" />
            </div>
          )}

          {!loading && !user && (
            <div className="bg-[var(--color-surface)] border border-red-500/30 rounded-2xl p-6 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-2">
                <h3 className="font-bold text-white">로그인이 필요합니다</h3>
                <p className="text-sm text-[var(--color-muted)]">
                  설정 페이지는 로그인 후 이용할 수 있습니다.
                </p>
              </div>
            </div>
          )}

          {!loading && user && (
            <>
              <Section icon={<User className="w-5 h-5" />} title="계정">
                <Row label="이메일" icon={<Mail className="w-4 h-4 text-[var(--color-muted)]" />}>
                  <span className="text-white">{user.email ?? "-"}</span>
                </Row>
                <Row label="표시 이름" icon={<Sparkles className="w-4 h-4 text-[var(--color-muted)]" />}>
                  <span className="text-white">{displayNameOf(user)}</span>
                </Row>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleSignOut}
                    disabled={signingOut}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--color-border)] text-[var(--color-muted)] hover:text-white hover:border-red-400/40 hover:bg-red-500/10 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                  >
                    {signingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                    로그아웃
                  </button>
                </div>
              </Section>

              <Section icon={<Briefcase className="w-5 h-5" />} title="워크스페이스">
                <Row label="이름">
                  <span className="text-[var(--color-muted)]">My Workspace</span>
                </Row>
                <p className="text-xs text-[var(--color-muted)]/70 leading-relaxed pt-1">
                  팀 단위 워크스페이스 분리 및 멤버 초대 기능은 다음 릴리스에 추가될 예정입니다.
                </p>
              </Section>

              <Section
                icon={<Plug className="w-5 h-5" />}
                title="외부 API 연동"
                description="실제 연동은 백엔드 환경변수(supabase/.env)로 관리됩니다. 키가 없는 커넥터는 자동으로 비활성화되며 검색은 계속 정상 동작합니다 (Graceful Degradation)."
              >
                {lastSearchedAt !== null && (
                  <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-muted)]">
                    <Clock className="w-3 h-3" />
                    마지막 검색 {formatRelative(lastSearchedAt, now)}
                  </div>
                )}
                <ul className="divide-y divide-[var(--color-border)]/60">
                  {CONNECTOR_STATUSES.map((c) => {
                    const state = stateFor(c.name);
                    return (
                      <li key={c.name} className="flex items-center justify-between py-2.5 gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <ConnectorStatusDot state={state} />
                          <span className="text-sm text-white truncate">{c.label}</span>
                        </div>
                        <ConnectorStatusChip state={state} envHint={c.envHint} />
                      </li>
                    );
                  })}
                </ul>
                {!isSupabaseConfigured && (
                  <div className="text-xs text-amber-300/90 bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2 mt-3 flex gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>
                      Supabase가 설정되지 않아 검색은 Mock 모드로 동작합니다. <code className="font-mono">.env.local</code>에{" "}
                      <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code>와{" "}
                      <code className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>를 추가하세요.
                    </span>
                  </div>
                )}
              </Section>

              <Section icon={<CreditCard className="w-5 h-5" />} title="요금제">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-accent-green)] bg-[var(--color-accent-green)]/10 px-2.5 py-1 rounded-md">
                      <CheckCircle2 className="w-3.5 h-3.5" /> 베타 (무료)
                    </span>
                    <span className="text-sm text-[var(--color-muted)]">
                      모든 검색·보관·공유 기능 무제한 사용 중
                    </span>
                  </div>
                </div>
                <p className="text-xs text-[var(--color-muted)]/70 leading-relaxed pt-2">
                  유료 플랜 전환 일정과 제한은 정식 출시 시 별도 안내됩니다.
                </p>
              </Section>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function Section({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 space-y-3">
      <div className="space-y-1.5">
        <h2 className="flex items-center gap-2 text-white font-bold text-base">
          <span className="text-[var(--color-primary)]">{icon}</span>
          {title}
        </h2>
        {description && (
          <p className="text-xs text-[var(--color-muted)] leading-relaxed">{description}</p>
        )}
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Row({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <div className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
        {icon}
        {label}
      </div>
      <div className="text-sm text-right truncate min-w-0">{children}</div>
    </div>
  );
}

// Severity tiers for connector failures. RATE_LIMITED is recoverable (just
// wait), FORBIDDEN is a hard auth/permission block, UPSTREAM_FAILED is the
// generic 5xx/parse bucket. Unknown codes fall back to the generic tier.
type FailureTier = "warn" | "danger" | "neutral";

function tierFor(code: string): FailureTier {
  if (code === "RATE_LIMITED") return "warn";
  if (code === "FORBIDDEN") return "danger";
  return "neutral";
}

const FAILURE_TIER_CLASSES: Record<
  FailureTier,
  { dot: string; chip: string }
> = {
  warn: {
    dot: "text-amber-400",
    chip: "text-amber-200 bg-amber-500/10 border-amber-500/30",
  },
  danger: {
    dot: "text-red-400",
    chip: "text-red-200 bg-red-500/10 border-red-500/40",
  },
  neutral: {
    dot: "text-[var(--color-accent-orange)]",
    chip: "text-[var(--color-accent-orange)] bg-[var(--color-accent-orange)]/10 border-[var(--color-accent-orange)]/30",
  },
};

function ConnectorStatusDot({ state }: { state: ConnectorRunState }) {
  if (state.kind === "succeeded") {
    return <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-accent-green)] shrink-0" />;
  }
  if (state.kind === "failed") {
    const cls = FAILURE_TIER_CLASSES[tierFor(state.failure.code)].dot;
    return <XCircle className={`w-3.5 h-3.5 shrink-0 ${cls}`} />;
  }
  return <Circle className="w-2 h-2 text-[var(--color-muted)] shrink-0 fill-current" />;
}

function ConnectorStatusChip({
  state,
  envHint,
}: {
  state: ConnectorRunState;
  envHint: string;
}) {
  if (state.kind === "failed") {
    const cls = FAILURE_TIER_CLASSES[tierFor(state.failure.code)].chip;
    return (
      <span
        title={state.failure.message ?? state.failure.code}
        className={`text-[10px] font-mono border px-2 py-0.5 rounded shrink-0 max-w-[14rem] truncate ${cls}`}
      >
        {state.failure.code}
      </span>
    );
  }
  if (state.kind === "succeeded") {
    return (
      <span className="text-[10px] font-medium text-[var(--color-accent-green)] bg-[var(--color-accent-green)]/10 border border-[var(--color-accent-green)]/30 px-2 py-0.5 rounded shrink-0">
        연동됨
      </span>
    );
  }
  return (
    <code className="text-[10px] text-[var(--color-muted)] font-mono bg-black/30 px-2 py-0.5 rounded shrink-0">
      {envHint}
    </code>
  );
}
