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
import type { Citation, Project, ReportItem, SearchReport } from "@/lib/types";

interface Props {
  item: ReportItem;
  report?: SearchReport | null;
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

export default function ReportDetailPanel({ item, report, enableActions = false }: Props) {
  const citations = mergedCitations(item);
  const trendScore = report?.trend_score;
  const target = useSearchStore((s) => s.filters.target);

  const [modalOpen, setModalOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [savedTo, setSavedTo] = useState<Project | null>(null);

  return (
    <div className="h-full bg-[var(--color-surface)] border-l border-[var(--color-border)] p-8 overflow-y-auto flex flex-col gap-8 animate-in slide-in-from-right-8 duration-500">
      <div className="flex justify-between items-start gap-4">
        <h2 className="text-2xl font-bold text-white leading-tight">{item.title}</h2>
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

      {item.summary && (
        <p className="text-gray-300 leading-relaxed text-sm border-l-2 border-[var(--color-border)] pl-4">
          {item.summary}
        </p>
      )}

      {/* Trend Chart Section */}
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-white font-bold text-lg">
            <TrendingUp className="w-5 h-5 text-[var(--color-accent-green)]" />
            글로벌 상승 트렌드 지수
          </div>
          {typeof trendScore === "number" && (
            <span className="text-2xl font-black text-[var(--color-accent-green)]">
              {trendScore}
            </span>
          )}
        </div>
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

      {/* Source Links Section */}
      {citations.length > 0 && (
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
