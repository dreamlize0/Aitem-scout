"use client";

import { Sparkles, ChevronRight, Search, ExternalLink } from "lucide-react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ItemGroup, SourcePlatform } from "@/lib/types";

export function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

interface Props {
  group: ItemGroup;
  isSelected: boolean;
  onClick: () => void;
  // Related-group only: dispatched when the user wants to start a fresh search
  // on the group's name instead of drilling into evidence.
  onResearch?: (name: string) => void;
  // Optional staggered entrance — caller passes the list index so each card
  // animates in slightly after the one above.
  enterIndex?: number;
}

// Brand-tinted single-letter / icon badge per platform. Keeping the colors
// tight to PRD's "각 트렌드 카드 내에 네이버, 유튜브, 인스타그램, X, 스레드의
// 공식 브랜드 아이콘 컬러를 그대로 사용" guidance.
const PLATFORM_BADGE: Record<SourcePlatform | "default", { label: string; color: string }> = {
  naver: { label: "N", color: "bg-[#03C75A]/20 text-[#03C75A] border-[#03C75A]/30" },
  kakao: { label: "K", color: "bg-[#FEE500]/20 text-[#FEE500] border-[#FEE500]/30" },
  youtube: { label: "Y", color: "bg-[#FF0000]/20 text-[#FF6B6B] border-[#FF0000]/30" },
  instagram: { label: "Ig", color: "bg-[#E1306C]/20 text-[#E1306C] border-[#E1306C]/30" },
  x: { label: "𝕏", color: "bg-white/10 text-white border-white/20" },
  threads: { label: "Th", color: "bg-white/10 text-gray-200 border-white/20" },
  google_trends: { label: "G", color: "bg-[#4285F4]/20 text-[#4285F4] border-[#4285F4]/30" },
  web: { label: "W", color: "bg-[var(--color-muted)]/20 text-[var(--color-muted)] border-[var(--color-muted)]/30" },
  default: { label: "?", color: "bg-[var(--color-muted)]/20 text-[var(--color-muted)] border-[var(--color-muted)]/30" },
};

export default function GroupCard({ group, isSelected, onClick, onResearch, enterIndex }: Props) {
  const primary = group.evidence[0];
  // Distinct platforms backing this group, in first-occurrence order.
  const platforms = Array.from(
    group.evidence.reduce((set, e) => set.add(e.source_platform), new Set<SourcePlatform>()),
  );
  const evidenceCount = group.evidence.length;

  const delayMs = typeof enterIndex === "number" ? Math.min(enterIndex, 7) * 60 : undefined;
  const enterClass =
    delayMs !== undefined ? "animate-in fade-in slide-in-from-bottom-2 duration-300" : "";
  const enterStyle =
    delayMs !== undefined
      ? { animationDelay: `${delayMs}ms`, animationFillMode: "both" as const }
      : undefined;

  return (
    <div
      onClick={onClick}
      style={enterStyle}
      className={cn(
        "bg-[var(--color-surface)] border rounded-2xl p-6 cursor-pointer transition-all duration-300 group",
        enterClass,
        isSelected
          ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5"
          : "border-[var(--color-border)] hover:border-[var(--color-primary)]/50 hover:bg-[var(--color-surface-hover)]",
      )}
    >
      <div className="flex gap-6 items-start">
        <div className="w-32 h-24 bg-gradient-to-br from-[var(--color-surface-hover)] to-[var(--color-border)] rounded-xl flex items-center justify-center overflow-hidden shrink-0">
          {primary?.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={primary.thumbnail_url}
              alt=""
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <Sparkles className="w-8 h-8 text-[var(--color-muted)] opacity-50 transition-transform duration-500 group-hover:scale-110" />
          )}
        </div>

        <div className="flex-1 space-y-3 min-w-0">
          <div className="flex justify-between items-start gap-3">
            <div className="flex items-center gap-2 min-w-0 flex-wrap">
              <h3 className="text-xl font-bold text-white group-hover:text-[var(--color-primary)] transition-colors leading-tight">
                {group.name}
              </h3>
              <span
                className={cn(
                  "text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-md border shrink-0",
                  group.type === "main"
                    ? "bg-[var(--color-primary)]/15 text-[var(--color-primary)] border-[var(--color-primary)]/30"
                    : "bg-[var(--color-accent-green)]/10 text-[var(--color-accent-green)] border-[var(--color-accent-green)]/30",
                )}
              >
                {group.type === "main" ? "메인" : "연관"}
              </span>
            </div>
          </div>

          {group.recommendation_reason && (
            <p className="text-xs text-[var(--color-primary)]/90 line-clamp-3 bg-[var(--color-primary)]/5 rounded-md px-2 py-1.5">
              <Sparkles className="inline w-3 h-3 mr-1 -mt-0.5" />
              {group.recommendation_reason}
            </p>
          )}

          <div className="flex items-center justify-between gap-3 text-xs text-[var(--color-muted)]">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="inline-flex items-center gap-1">
                <ExternalLink className="w-3 h-3" />
                {evidenceCount}개 출처
              </span>
              <div className="flex items-center gap-1">
                {platforms.map((p) => {
                  const badge = PLATFORM_BADGE[p] ?? PLATFORM_BADGE.default;
                  return (
                    <span
                      key={p}
                      className={cn(
                        "inline-flex items-center justify-center w-6 h-6 rounded-md border text-[11px] font-bold",
                        badge.color,
                      )}
                      title={p}
                    >
                      {badge.label}
                    </span>
                  );
                })}
              </div>
            </div>

            {group.type === "related" && onResearch && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onResearch(group.name);
                }}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-[var(--color-border)] text-[var(--color-muted)] hover:text-white hover:border-white/30 transition-colors"
              >
                <Search className="w-3 h-3" />
                이 아이템으로 검색
              </button>
            )}
          </div>
        </div>

        <div className="pt-2">
          <ChevronRight
            className={cn(
              "w-5 h-5 transition-transform duration-300",
              isSelected
                ? "text-[var(--color-primary)] translate-x-1"
                : "text-[var(--color-muted)]",
            )}
          />
        </div>
      </div>
    </div>
  );
}
