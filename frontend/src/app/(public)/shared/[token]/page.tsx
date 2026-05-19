"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  X,
} from "lucide-react";
import SearchResultCard from "@/components/SearchResultCard";
import ReportDetailPanel from "@/components/ReportDetailPanel";
import { ApiClientError, fetchShared, isSupabaseConfigured } from "@/lib/api";
import { savedItemToReportItem } from "@/lib/types";
import type { ReportItem, ShareViewData } from "@/lib/types";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default function SharedViewPage({ params }: PageProps) {
  const { token } = use(params);

  const [data, setData] = useState<ShareViewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    if (!isSupabaseConfigured) {
      setError("백엔드 환경변수가 설정되지 않았습니다 (.env.local).");
      setLoading(false);
      return;
    }

    fetchShared(token)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof ApiClientError
            ? err.code === "NOT_FOUND"
              ? "공유 링크를 찾을 수 없거나 비활성화되었습니다."
              : `[${err.code}] ${err.message}`
            : err instanceof Error
              ? err.message
              : "공유 페이지 로드 중 오류가 발생했습니다.";
        setError(message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const items = data?.items ?? [];
  const selectedSaved = items.find((i) => i.id === selectedId) ?? null;
  const selectedReportItem: ReportItem | null = selectedSaved
    ? savedItemToReportItem(selectedSaved)
    : null;

  return (
    <div className="h-screen bg-[var(--color-background)] flex flex-col overflow-hidden">
      <header className="h-16 shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface)] flex items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 text-[var(--color-primary)] font-bold text-lg min-w-0">
          <Sparkles className="w-5 h-5 shrink-0" />
          <span className="shrink-0">AItem Scout</span>
          <span className="text-sm font-normal text-[var(--color-muted)] ml-2 bg-white/5 px-2 py-0.5 rounded-md truncate">
            {data?.project.name ?? "공유된 리포트"}
          </span>
        </Link>
        <div className="flex items-center gap-2 text-sm text-[var(--color-muted)] shrink-0">
          <ShieldCheck className="w-4 h-4 text-[var(--color-accent-green)]" />
          읽기 전용
        </div>
      </header>

      <main className="flex-1 min-h-0 flex overflow-hidden">
        {loading && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[var(--color-muted)]">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
            <p className="text-sm">공유 리포트를 불러오는 중…</p>
          </div>
        )}

        {!loading && error && (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="max-w-md w-full bg-[var(--color-surface)] border border-red-500/30 rounded-2xl p-6 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h2 className="font-bold text-white">리포트를 표시할 수 없습니다</h2>
                <p className="text-sm text-[var(--color-muted)] break-words">{error}</p>
              </div>
            </div>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-[var(--color-muted)] text-sm">
            공유된 아이템이 없습니다.
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <>
            <div className="flex-1 overflow-y-auto p-6 md:p-8">
              <div className="max-w-3xl mx-auto space-y-4">
                {data?.project.description && (
                  <p className="text-sm text-[var(--color-muted)] leading-relaxed border-l-2 border-[var(--color-border)] pl-3 mb-6">
                    {data.project.description}
                  </p>
                )}
                {items.map((it) => (
                  <SearchResultCard
                    key={it.id}
                    item={savedItemToReportItem(it)}
                    isSelected={selectedId === it.id}
                    onClick={() => setSelectedId(it.id)}
                  />
                ))}
              </div>
            </div>

            {selectedReportItem ? (
              <div className="w-[480px] shrink-0 h-full relative border-l border-[var(--color-border)] hidden lg:block">
                <button
                  onClick={() => setSelectedId(null)}
                  className="absolute top-6 right-6 p-2 bg-black/50 hover:bg-black/80 rounded-full text-white z-10 transition-colors"
                  aria-label="패널 닫기"
                >
                  <X className="w-5 h-5" />
                </button>
                <ReportDetailPanel
                  key={selectedReportItem.id}
                  item={selectedReportItem}
                  enableActions={false}
                />
              </div>
            ) : (
              <div className="w-[480px] shrink-0 h-full bg-[var(--color-surface)] border-l border-[var(--color-border)] hidden lg:flex items-center justify-center p-8 text-center text-[var(--color-muted)]">
                <div className="space-y-4">
                  <Sparkles className="w-12 h-12 mx-auto opacity-20" />
                  <p>
                    좌측에서 아이템을 선택하면
                    <br />
                    상세 정보가 표시됩니다.
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Mobile: full-screen overlay panel since the right column is hidden on <lg */}
      {selectedReportItem && (
        <div className="lg:hidden fixed inset-0 z-30 bg-[var(--color-background)] flex flex-col">
          <button
            onClick={() => setSelectedId(null)}
            className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/80 rounded-full text-white z-10 transition-colors"
            aria-label="패널 닫기"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex-1 overflow-y-auto">
            <ReportDetailPanel
              key={selectedReportItem.id}
              item={selectedReportItem}
              enableActions={false}
            />
          </div>
        </div>
      )}
    </div>
  );
}
