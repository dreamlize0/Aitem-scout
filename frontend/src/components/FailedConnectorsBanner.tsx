"use client";

import { AlertTriangle } from "lucide-react";
import type { ConnectorFailure } from "@/lib/types";

interface Props {
  failures: ConnectorFailure[];
}

const CONNECTOR_LABEL: Record<string, string> = {
  naver: "네이버",
  kakao: "카카오",
  youtube: "YouTube",
  google_trends: "Google Trends",
  meta: "Instagram",
  threads: "Threads",
  x: "X (Twitter)",
  tavily: "웹 보조 검색",
};

// Mirrors the tier logic in settings page so the same failure category looks
// identical wherever it surfaces in the app.
type Tier = "warn" | "danger" | "neutral";
function tierFor(code: string): Tier {
  if (code === "RATE_LIMITED") return "warn";
  if (code === "FORBIDDEN") return "danger";
  return "neutral";
}

const TIER_CLASSES: Record<Tier, string> = {
  warn: "text-amber-200 bg-amber-500/10 border-amber-500/30",
  danger: "text-red-200 bg-red-500/10 border-red-500/40",
  neutral:
    "text-[var(--color-accent-orange)] bg-[var(--color-accent-orange)]/10 border-[var(--color-accent-orange)]/30",
};

const CODE_LABEL: Record<string, string> = {
  RATE_LIMITED: "일시 한도",
  FORBIDDEN: "권한 차단",
  UPSTREAM_FAILED: "응답 실패",
};

export default function FailedConnectorsBanner({ failures }: Props) {
  if (failures.length === 0) return null;
  return (
    <div className="text-xs text-amber-300/90 bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2.5 flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1.5 text-amber-300/90 shrink-0">
        <AlertTriangle className="w-3.5 h-3.5" />
        일부 출처 미수집
      </span>
      <div className="flex flex-wrap gap-1.5">
        {failures.map((f) => {
          const cls = TIER_CLASSES[tierFor(f.code)];
          const label = CONNECTOR_LABEL[f.name] ?? f.name;
          const codeLabel = CODE_LABEL[f.code] ?? f.code;
          return (
            <span
              key={f.name}
              title={f.message ?? f.code}
              className={`inline-flex items-center gap-1 text-[11px] font-medium border px-2 py-0.5 rounded ${cls}`}
            >
              <span>{label}</span>
              <span className="opacity-70">·</span>
              <span className="font-mono text-[10px]">{codeLabel}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
