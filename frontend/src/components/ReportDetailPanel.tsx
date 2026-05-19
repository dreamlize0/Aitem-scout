"use client";

import { useState } from "react";
import {
  ExternalLink,
  Sparkles,
  FolderPlus,
  PlaySquare,
  Image as ImageIcon,
  MessageCircle,
  TrendingUp,
  Check,
  Send,
} from "lucide-react";
import TrendChart from "./TrendChart";
import SaveToFolderModal from "./SaveToFolderModal";
import ColdContactModal from "./ColdContactModal";
import { useSearchStore } from "@/store/useSearchStore";
import type { Citation, ItemGroup, Project, ReportItem, SearchReport } from "@/lib/types";

interface Props {
  item: ReportItem;
  report?: SearchReport | null;
  // When set, the panel is showing a curated group rather than a single saved
  // item — we render an evidence list (rich cards) instead of the citations
  // URL grid. Storage/share views omit this and fall back to citations.
  group?: ItemGroup | null;
  // shared/public viewers pass false (or omit) — disables the save button.
  enableActions?: boolean;
}

function getPlatformIcon(platform: string) {
  switch (platform) {
    case "youtube":
      return <PlaySquare className="w-4 h-4 text-[#FF0000]" />;
    case "instagram":
      return <ImageIcon className="w-4 h-4 text-[#E1306C]" />;
    case "x":
      return (
        <span className="text-sm font-bold w-4 h-4 flex items-center justify-center text-white">
          𝕏
        </span>
      );
    case "naver":
      return (
        <span className="text-sm font-bold w-4 h-4 flex items-center justify-center text-[#03C75A]">
          N
        </span>
      );
    case "kakao":
      return (
        <span className="text-sm font-bold w-4 h-4 flex items-center justify-center text-[#FEE500]">
          K
        </span>
      );
    case "threads":
      return <MessageCircle className="w-4 h-4 text-white" />;
    case "google_trends":
      return <TrendingUp className="w-4 h-4 text-[#4285F4]" />;
    case "web":
      return <ExternalLink className="w-4 h-4 text-[var(--color-muted)]" />;
    default:
      return <ExternalLink className="w-4 h-4" />;
  }
}

function getPlatformName(platform: string) {
  const names: Record<string, string> = {
    youtube: "YouTube",
    instagram: "Instagram",
    x: "X (Twitter)",
    naver: "Naver",
    kakao: "Kakao",
    threads: "Threads",
    google_trends: "Google Trends",
    web: "Web",
  };
  return names[platform] || platform;
}

// Merge the item's source_url into the citation list, deduped by url.
function mergedCitations(item: ReportItem): Citation[] {
  const out: Citation[] = [];
  const seen = new Set<string>();
  const push = (c: Citation) => {
    if (!c.url || seen.has(c.url)) return;
    seen.add(c.url);
    out.push(c);
  };
  if (item.source_url) {
    push({ platform: item.source_platform, url: item.source_url });
  }
  for (const c of item.citations ?? []) push(c);
  return out;
}

export default function ReportDetailPanel({ item, report, group, enableActions = false }: Props) {
  const citations = mergedCitations(item);
  // Prefer the selected group's own score so the user can see how this item
  // ranks vs siblings; fall back to the query-level score for storage/share
  // views where there is no group context.
  const trendScore = group?.trend_score ?? report?.trend_score;
  const target = useSearchStore((s) => s.filters.target);
  const query = useSearchStore((s) => s.query);

  const [modalOpen, setModalOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [savedTo, setSavedTo] = useState<Project | null>(null);

  return (
    <div className="h-full bg-[var(--color-surface)] border-l border-[var(--color-border)] p-8 overflow-y-auto flex flex-col gap-8 animate-in slide-in-from-right-8 duration-500">
      <div className="flex justify-between items-start gap-4">
        <div className="min-w-0 flex items-center gap-2 flex-wrap">
          <h2 className="text-2xl font-bold text-white leading-tight">{item.title}</h2>
          {group && (
            <span
              className={
                "text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-md border shrink-0 " +
                (group.type === "main"
                  ? "bg-[var(--color-primary)]/15 text-[var(--color-primary)] border-[var(--color-primary)]/30"
                  : "bg-[var(--color-accent-green)]/10 text-[var(--color-accent-green)] border-[var(--color-accent-green)]/30")
              }
            >
              {group.type === "main" ? "메인" : "연관"}
            </span>
          )}
        </div>
        {enableActions && (
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => setContactOpen(true)}
              title="AI가 섭외 메일/DM/제안서 초안을 작성합니다"
              className="flex items-center gap-2 px-3 py-2 border border-[var(--color-border)] hover:border-[var(--color-primary)]/50 rounded-lg text-white font-medium transition-colors"
            >
              <Send className="w-4 h-4 text-[var(--color-primary)]" />
              콜드 컨택
            </button>
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] rounded-lg text-white font-medium transition-colors"
            >
              {savedTo ? <Check className="w-5 h-5" /> : <FolderPlus className="w-5 h-5" />}
              {savedTo ? `${savedTo.name}에 저장됨` : "보관함 저장"}
            </button>
          </div>
        )}
      </div>

      {/* In group mode the per-evidence summaries are richer than the primary
          item's standalone summary, so we hide this section and let the
          evidence list below carry that weight. */}
      {!group && item.summary && (
        <p className="text-gray-300 leading-relaxed text-sm border-l-2 border-[var(--color-border)] pl-4">
          {item.summary}
        </p>
      )}

      {/* Trend Chart Section — score is per-group (when a group is selected),
          chart is query-level (Google Trends time series for the whole search,
          not for each related item — that would mean N more API calls). The
          caption above the chart spells out the distinction so the same chart
          repeating across cards doesn't read as a bug. */}
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-white font-bold text-lg">
            <TrendingUp className="w-5 h-5 text-[var(--color-accent-green)]" />
            {group ? `${group.name} 트렌드 지수` : "글로벌 상승 트렌드 지수"}
          </div>
          {typeof trendScore === "number" && (
            <span className="text-2xl font-black text-[var(--color-accent-green)]">
              {trendScore}
            </span>
          )}
        </div>
        {group && (
          <div className="mt-2 text-[11px] text-[var(--color-muted)]">
            아래 차트는 검색어 <span className="text-gray-300">&apos;{query || "전체"}&apos;</span> 의 최근 12개월 글로벌 트렌드입니다.
          </div>
        )}
        <TrendChart data={report?.global_trend_chart} />
      </div>

      {/* AI Report Section */}
      {item.recommendation_reason && (
        <div className="bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/20 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-[var(--color-primary)] font-bold text-lg">
            <Sparkles className="w-5 h-5" />
            AI 추천 사유 리포트
          </div>
          <p className="text-gray-300 leading-relaxed text-[1.05rem]">
            {item.recommendation_reason}
          </p>
        </div>
      )}

      {/* Evidence list (group mode) — full cards with thumbnail + excerpt so
          the user can scan what this group actually contains. Falls back to
          the simple citations grid below when group is absent (storage view). */}
      {group && group.evidence.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-[var(--color-muted)] uppercase tracking-wider">
            근거 콘텐츠 ({group.evidence.length}개)
          </h3>
          <div className="grid gap-3">
            {group.evidence.map((e) => (
              <a
                key={e.id}
                href={e.source_url}
                target="_blank"
                rel="noreferrer"
                className="flex gap-3 p-3 bg-black/20 border border-[var(--color-border)] rounded-xl hover:border-gray-500 transition-colors group"
              >
                <div className="w-20 h-20 bg-[var(--color-surface-hover)] rounded-lg flex items-center justify-center overflow-hidden shrink-0">
                  {e.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={e.thumbnail_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-[var(--color-muted)]">{getPlatformIcon(e.source_platform)}</div>
                  )}
                </div>
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded bg-[var(--color-surface)] flex items-center justify-center shrink-0">
                      {getPlatformIcon(e.source_platform)}
                    </div>
                    <span className="text-[10px] font-medium text-[var(--color-muted)] uppercase tracking-wider">
                      {getPlatformName(e.source_platform)}
                    </span>
                  </div>
                  <div className="font-medium text-gray-200 group-hover:text-white transition-colors text-sm line-clamp-2">
                    {e.title}
                  </div>
                  {e.summary && (
                    <div className="text-xs text-[var(--color-muted)] line-clamp-2">
                      {e.summary}
                    </div>
                  )}
                </div>
                <ExternalLink className="w-4 h-4 text-[var(--color-muted)] group-hover:text-white transition-colors shrink-0 mt-1" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Citations grid (storage/share view fallback — no group context). */}
      {!group && citations.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-[var(--color-muted)] uppercase tracking-wider">
            데이터 출처 및 레퍼런스
          </h3>
          <div className="grid gap-3">
            {citations.map((source, idx) => (
              <a
                key={`${source.platform}-${idx}`}
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between p-4 bg-black/20 border border-[var(--color-border)] rounded-xl hover:border-gray-500 transition-colors group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-[var(--color-surface)] flex items-center justify-center shrink-0">
                    {getPlatformIcon(source.platform)}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-gray-200 group-hover:text-white transition-colors">
                      {getPlatformName(source.platform)} 원본 데이터 확인
                    </div>
                    {source.excerpt && (
                      <div className="text-xs text-[var(--color-muted)] line-clamp-1">
                        {source.excerpt}
                      </div>
                    )}
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-[var(--color-muted)] group-hover:text-white transition-colors shrink-0" />
              </a>
            ))}
          </div>
        </div>
      )}

      {modalOpen && (
        <SaveToFolderModal
          item={item}
          onClose={() => setModalOpen(false)}
          onSaved={(project) => setSavedTo(project)}
        />
      )}

      {contactOpen && (
        <ColdContactModal
          item={item}
          target={target}
          onClose={() => setContactOpen(false)}
        />
      )}
    </div>
  );
}
