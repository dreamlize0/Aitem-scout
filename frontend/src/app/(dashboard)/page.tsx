"use client";

import { useEffect, useState } from "react";
import { Search, Sparkles, Play, X, TrendingUp, AlertTriangle, LogOut, SlidersHorizontal, ChevronUp } from "lucide-react";
import { useSearchStore } from "@/store/useSearchStore";
import SkeletonLoader from "@/components/SkeletonLoader";
import SearchResultCard from "@/components/SearchResultCard";
import ReportDetailPanel from "@/components/ReportDetailPanel";
import SearchFilters from "@/components/SearchFilters";
import AppliedFilters from "@/components/AppliedFilters";
import FailedConnectorsBanner from "@/components/FailedConnectorsBanner";
import type { SearchFilters as Filters } from "@/lib/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, useAuth } from "@/lib/useAuth";
import { isSupabaseConfigured } from "@/lib/api";

function initialsFor(user: { email?: string | null; user_metadata?: Record<string, unknown> }) {
  const name = (user.user_metadata?.["full_name"] as string | undefined) ?? user.email ?? "?";
  return name.trim().slice(0, 2).toUpperCase();
}

export default function DashboardPage() {
  const {
    isSearching,
    hasSearched,
    query,
    filters,
    response,
    selectedItem,
    errorMessage,
    usedMock,
    setQuery,
    setFilters,
    performSearch,
    setSelectedItem,
  } = useSearchStore();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const items = response?.items ?? [];
  const report = response?.report ?? null;
  const failed = response?.connectors.failed ?? [];

  // Backend /search requires auth. In real-API mode an anonymous click would
  // otherwise just produce an UNAUTHORIZED error panel — bounce to login with
  // ?next so they return to the hero state after signing in. Mock mode
  // (Supabase not configured) stays open to anyone.
  const requireAuthOrLogin = (): boolean => {
    if (isSupabaseConfigured && !authLoading && !user) {
      router.push(`/login?next=${encodeURIComponent("/")}`);
      return false;
    }
    return true;
  };

  const handleSearch = () => {
    if (!requireAuthOrLogin()) return;
    performSearch();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (!requireAuthOrLogin()) return;
      performSearch();
    }
  };

  // Removing a chip in the results view should trigger a fresh search — the user
  // signalled a clear intent to update the result set with the narrower filters.
  const handleAppliedFiltersChange = (next: Filters) => {
    setFilters(next);
    if (!requireAuthOrLogin()) return;
    performSearch();
  };

  // Collapsible filter editor on the results view. Edits accumulate in a draft
  // and only land in the store + trigger a search when the user explicitly hits
  // "AI 다시 스카우트" — so toggling many chips doesn't fire N searches.
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState<Filters>(filters);

  useEffect(() => {
    // Keep the draft in sync with external changes (chip-X removals) while the
    // panel is closed. When the panel is open the draft is authoritative.
    if (!filterPanelOpen) setDraftFilters(filters);
  }, [filters, filterPanelOpen]);

  const applyAndSearch = () => {
    setFilters(draftFilters);
    if (!requireAuthOrLogin()) return;
    performSearch();
    setFilterPanelOpen(false);
  };

  return (
    <>
      {/* Header */}
      <header className="h-16 border-b border-[var(--color-border)] bg-[var(--color-background)]/80 backdrop-blur-sm flex items-center justify-between px-8 sticky top-0 z-10">
        <div className="flex-1 max-w-2xl transition-opacity duration-300">
          {hasSearched && !isSearching && (
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-[var(--color-muted)] absolute left-4" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="추가 검색어를 입력하세요"
                className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-full pl-11 pr-4 py-2 text-white text-sm outline-none focus:border-[var(--color-primary)]/50 transition-colors"
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 ml-4">
          {usedMock && hasSearched && (
            <span className="text-xs text-[var(--color-muted)] bg-[var(--color-surface-hover)] px-2 py-1 rounded-md">
              Mock 모드 (.env.local 미설정)
            </span>
          )}
          {!authLoading && !user && (
            <Link
              href="/login"
              className="px-4 py-1.5 text-sm font-medium text-[var(--color-muted)] hover:text-white transition-colors"
            >
              로그인
            </Link>
          )}
          {user && (
            <>
              <span className="text-xs text-[var(--color-muted)] hidden md:inline">
                {user.email}
              </span>
              <button
                onClick={() => signOut()}
                title="로그아웃"
                className="p-1.5 text-[var(--color-muted)] hover:text-white transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
              <div className="w-8 h-8 rounded-full bg-[var(--color-primary)]/20 text-[var(--color-primary)] flex items-center justify-center font-bold text-sm">
                {initialsFor(user)}
              </div>
            </>
          )}
          {!user && (
            <div className="w-8 h-8 rounded-full bg-[var(--color-surface-hover)] text-[var(--color-muted)] flex items-center justify-center font-bold text-sm">
              ?
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-hidden relative">
        {/* 1. Hero State */}
        {!hasSearched && (
          <div className="h-full overflow-y-auto p-8 animate-in fade-in duration-500">
            <div className="max-w-4xl mx-auto space-y-12 pt-10">
              <div className="text-center space-y-4">
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
                  어떤 촬영 <span className="text-[var(--color-primary)]">아이템</span>을
                  찾으시나요?
                </h1>
                <p className="text-[var(--color-muted)] text-lg">
                  키워드, 테마, 타겟을 입력하면 AI가 전 세계의 트렌드를 분석해 제안합니다.
                </p>
              </div>

              <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 shadow-2xl transition-all duration-300 focus-within:border-[var(--color-primary)]">
                <div className="flex items-center gap-3 px-4">
                  <Search className="w-6 h-6 text-[var(--color-muted)]" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="'40대 여성', '일본인 관광객', '가성비 오마카세' 등 자유롭게 입력해보세요"
                    className="flex-1 bg-transparent border-none outline-none text-white text-lg py-4 placeholder-[var(--color-muted)]/70"
                  />
                  <button
                    onClick={handleSearch}
                    className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white px-8 py-3 rounded-xl font-medium transition-colors flex items-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    AI 스카우트
                  </button>
                </div>

              </div>

              <SearchFilters value={filters} onChange={setFilters} />

              <div className="space-y-4">
                <h3 className="text-sm font-medium text-[var(--color-muted)] flex items-center gap-2">
                  <Play className="w-4 h-4" /> 최근 급상승 테마
                </h3>
                <div className="flex flex-wrap gap-3">
                  {[
                    "# 성수동 팝업스토어",
                    "# 50대 부모님 효도여행",
                    "# 10만원대 호캉스",
                    "# 외국인 반응 좋은 로컬 식당",
                  ].map((tag) => (
                    <button
                      key={tag}
                      onClick={() => {
                        setQuery(tag.replace("# ", ""));
                        if (!requireAuthOrLogin()) return;
                        performSearch();
                      }}
                      className="px-4 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-sm text-gray-300 hover:border-[var(--color-accent-green)]/50 hover:text-[var(--color-accent-green)] transition-all"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. Searching */}
        {hasSearched && isSearching && (
          <div className="h-full overflow-y-auto animate-in fade-in duration-300">
            <SkeletonLoader />
          </div>
        )}

        {/* 3. Error */}
        {hasSearched && !isSearching && errorMessage && (
          <div className="h-full flex items-center justify-center p-8">
            <div className="max-w-md text-center space-y-3 bg-[var(--color-surface)] border border-red-500/30 rounded-2xl p-8">
              <AlertTriangle className="w-10 h-10 mx-auto text-red-400" />
              <h3 className="text-lg font-bold text-white">검색 중 오류가 발생했습니다</h3>
              <p className="text-sm text-[var(--color-muted)] break-words">{errorMessage}</p>
              <button
                onClick={() => handleSearch()}
                className="mt-2 px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-hover)] transition-colors"
              >
                다시 시도
              </button>
            </div>
          </div>
        )}

        {/* 4. Results */}
        {hasSearched && !isSearching && !errorMessage && response && (
          <div className="flex h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Left: Result List */}
            <div className="flex-1 overflow-y-auto p-8 border-r border-[var(--color-border)]">
              <div className="max-w-3xl mx-auto space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-[var(--color-border)] gap-4 flex-wrap">
                  <h2 className="text-lg font-medium text-[var(--color-muted)]">
                    <span className="text-white font-bold">&apos;{query || "추천"}&apos;</span>{" "}
                    에 대한 AI 분석 결과 ({items.length}건)
                  </h2>
                  {report && (
                    <div className="flex items-center gap-1 text-[var(--color-accent-green)] text-sm font-bold bg-[var(--color-accent-green)]/10 px-2.5 py-1 rounded-md">
                      <TrendingUp className="w-4 h-4" />
                      트렌드 {report.trend_score}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <AppliedFilters value={filters} onChange={handleAppliedFiltersChange} />
                  <button
                    type="button"
                    onClick={() => setFilterPanelOpen((v) => !v)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-muted)] hover:text-white border border-[var(--color-border)] hover:border-white/20 rounded-full px-3 py-1 transition-colors ml-auto"
                  >
                    {filterPanelOpen ? (
                      <>
                        <ChevronUp className="w-3.5 h-3.5" /> 필터 닫기
                      </>
                    ) : (
                      <>
                        <SlidersHorizontal className="w-3.5 h-3.5" /> 필터 수정
                      </>
                    )}
                  </button>
                </div>

                {filterPanelOpen && (
                  <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                    <SearchFilters value={draftFilters} onChange={setDraftFilters} />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setDraftFilters(filters);
                          setFilterPanelOpen(false);
                        }}
                        className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-[var(--color-muted)] hover:text-white hover:border-white/20 text-sm font-medium transition-colors"
                      >
                        취소
                      </button>
                      <button
                        type="button"
                        onClick={applyAndSearch}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-sm font-bold transition-colors"
                      >
                        <Sparkles className="w-4 h-4" />
                        AI 다시 스카우트
                      </button>
                    </div>
                  </div>
                )}

                {report?.summary && (
                  <div className="bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/20 rounded-2xl p-5 space-y-2">
                    <div className="flex items-center gap-2 text-[var(--color-primary)] font-bold text-sm">
                      <Sparkles className="w-4 h-4" /> AI 통합 인사이트
                    </div>
                    <p className="text-gray-200 text-sm leading-relaxed">{report.summary}</p>
                    {report.top_themes.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-2">
                        {report.top_themes.map((t) => (
                          <span
                            key={t}
                            className="text-xs font-medium text-[var(--color-accent-green)] bg-[var(--color-accent-green)]/10 px-2 py-1 rounded-md"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <FailedConnectorsBanner failures={failed} />

                <div className="space-y-4">
                  {items.map((item, idx) => (
                    <SearchResultCard
                      key={item.id}
                      item={item}
                      isSelected={selectedItem?.id === item.id}
                      onClick={() => setSelectedItem(item)}
                      enterIndex={idx}
                    />
                  ))}
                  {items.length === 0 && (
                    <div className="text-center text-[var(--color-muted)] py-10">
                      결과가 없습니다. 다른 키워드나 필터를 시도해 보세요.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Detail Panel */}
            {selectedItem ? (
              <div className="w-[480px] shrink-0 h-full relative">
                <button
                  onClick={() => setSelectedItem(null)}
                  className="absolute top-6 right-6 p-2 bg-black/50 hover:bg-black/80 rounded-full text-white z-10 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
                <ReportDetailPanel
                  key={selectedItem.id}
                  item={selectedItem}
                  report={report}
                  enableActions={!!user}
                />
              </div>
            ) : (
              <div className="w-[480px] shrink-0 h-full bg-[var(--color-surface)] border-l border-[var(--color-border)] flex items-center justify-center p-8 text-center text-[var(--color-muted)]">
                <div className="space-y-4">
                  <Sparkles className="w-12 h-12 mx-auto opacity-20" />
                  <p>
                    좌측 목록에서 아이템을 선택하시면
                    <br />
                    상세 AI 추천 리포트가 표시됩니다.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
