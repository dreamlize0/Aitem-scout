import { Sparkles, ChevronRight, ExternalLink } from "lucide-react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ReportItem } from "@/lib/types";

export function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

interface Props {
  item: ReportItem;
  isSelected: boolean;
  onClick: () => void;
  // Optional staggered entrance — caller passes the list index so each card
  // animates in slightly after the one above. Skipped when undefined so
  // re-renders (e.g. selection change) don't replay the entrance.
  enterIndex?: number;
}

const PLATFORM_LABEL: Record<string, string> = {
  naver: "Naver",
  kakao: "Kakao",
  youtube: "YouTube",
  instagram: "Instagram",
  x: "X",
  threads: "Threads",
  google_trends: "Google Trends",
  web: "Web",
};

export default function SearchResultCard({ item, isSelected, onClick, enterIndex }: Props) {
  const platformLabel = PLATFORM_LABEL[item.source_platform] ?? item.source_platform;
  const citationCount = item.citations?.length ?? 0;
  // Saved items carry their group context in metadata (see groupToReportItem).
  // Older saves predate this and won't have group_type — only render the
  // badge when the field is present and well-formed.
  const groupType = item.metadata?.group_type;
  const groupBadge =
    groupType === "main" ? "메인" : groupType === "related" ? "연관" : null;

  // Cap the delay so a long result list doesn't keep the user waiting on a
  // visible cascade — past index 7 every remaining card lands on the same beat.
  const delayMs =
    typeof enterIndex === "number" ? Math.min(enterIndex, 7) * 60 : undefined;
  const enterClass =
    delayMs !== undefined ? "animate-in fade-in slide-in-from-bottom-2 duration-300" : "";
  // fill-mode-both keeps the pre-animation state hidden until the delay
  // elapses, so cards don't briefly flash in their final position. The Tailwind
  // utility for this is unreliable across versions — inline style is safer.
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
          {item.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.thumbnail_url}
              alt=""
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <Sparkles className="w-8 h-8 text-[var(--color-muted)] opacity-50 transition-transform duration-500 group-hover:scale-110" />
          )}
        </div>

        <div className="flex-1 space-y-3 min-w-0">
          <div className="flex justify-between items-start gap-3">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <h3 className="text-xl font-bold text-white group-hover:text-[var(--color-primary)] transition-colors line-clamp-2">
                {item.title}
              </h3>
              {groupBadge && (
                <span
                  className={cn(
                    "text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-md border shrink-0",
                    groupType === "main"
                      ? "bg-[var(--color-primary)]/15 text-[var(--color-primary)] border-[var(--color-primary)]/30"
                      : "bg-[var(--color-accent-green)]/10 text-[var(--color-accent-green)] border-[var(--color-accent-green)]/30",
                  )}
                >
                  {groupBadge}
                </span>
              )}
            </div>
            <span className="text-xs font-medium text-[var(--color-muted)] bg-[var(--color-surface-hover)] px-2 py-1 rounded-md shrink-0">
              {platformLabel}
            </span>
          </div>

          {item.summary && (
            <p className="text-[var(--color-muted)] text-sm line-clamp-2">{item.summary}</p>
          )}

          {item.recommendation_reason && (
            <p className="text-xs text-[var(--color-primary)]/90 line-clamp-2 bg-[var(--color-primary)]/5 rounded-md px-2 py-1.5">
              <Sparkles className="inline w-3 h-3 mr-1 -mt-0.5" />
              {item.recommendation_reason}
            </p>
          )}

          <div className="flex items-center gap-3 text-xs text-[var(--color-muted)]">
            <span className="inline-flex items-center gap-1">
              <ExternalLink className="w-3 h-3" />
              {citationCount}개 출처
            </span>
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
