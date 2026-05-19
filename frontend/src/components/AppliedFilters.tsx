"use client";

import { X } from "lucide-react";
import type { SearchFilters as Filters } from "@/lib/types";

interface Props {
  value: Filters;
  onChange: (next: Filters) => void;
}

const GENDER_LABEL: Record<string, string> = { female: "여성", male: "남성", any: "" };
const AGE_LABEL: Record<string, string> = {
  "10-20": "10대",
  "20-30": "20대",
  "30-40": "30대",
  "40-50": "40대",
  "50+": "50대+",
  any: "",
};
const LIFESTYLE_LABEL: Record<string, string> = {
  city: "도심",
  outdoor: "야외",
  family: "가족",
  premium: "프리미엄",
  budget: "가성비",
};
const COUNTRY_LABEL: Record<string, string> = {
  JP: "🇯🇵 일본",
  US: "🇺🇸 미국",
  CN: "🇨🇳 중국",
  TW: "🇹🇼 대만",
  TH: "🇹🇭 태국",
  VN: "🇻🇳 베트남",
};

interface Chip {
  key: string;
  label: string;
  remove: (f: Filters) => Filters;
}

function buildChips(value: Filters): Chip[] {
  const chips: Chip[] = [];

  for (const t of value.theme ?? []) {
    chips.push({
      key: `theme-${t}`,
      label: `# ${t}`,
      remove: (f) => ({ ...f, theme: (f.theme ?? []).filter((x) => x !== t) }),
    });
  }

  const target = value.target ?? {};
  if (target.gender && target.gender !== "any") {
    chips.push({
      key: "target-gender",
      label: GENDER_LABEL[target.gender] ?? target.gender,
      remove: (f) => ({ ...f, target: { ...(f.target ?? {}), gender: "any" } }),
    });
  }
  if (target.age_range && target.age_range !== "any") {
    chips.push({
      key: "target-age",
      label: AGE_LABEL[target.age_range] ?? target.age_range,
      remove: (f) => ({ ...f, target: { ...(f.target ?? {}), age_range: "any" } }),
    });
  }
  if (target.lifestyle) {
    chips.push({
      key: "target-lifestyle",
      label: LIFESTYLE_LABEL[target.lifestyle] ?? target.lifestyle,
      remove: (f) => ({ ...f, target: { ...(f.target ?? {}), lifestyle: undefined } }),
    });
  }

  for (const code of value.global_targets ?? []) {
    chips.push({
      key: `country-${code}`,
      label: COUNTRY_LABEL[code] ?? code,
      remove: (f) => ({
        ...f,
        global_targets: (f.global_targets ?? []).filter((x) => x !== code),
      }),
    });
  }

  return chips;
}

export default function AppliedFilters({ value, onChange }: Props) {
  const chips = buildChips(value);
  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-[var(--color-muted)] mr-1">적용 필터</span>
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={() => onChange(c.remove(value))}
          title="필터 제거 후 재검색"
          className="group flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-[var(--color-primary)]/40 bg-[var(--color-primary)]/10 text-[var(--color-primary)] hover:border-red-400/60 hover:bg-red-500/10 hover:text-red-300 transition-colors"
        >
          <span>{c.label}</span>
          <X className="w-3 h-3 opacity-60 group-hover:opacity-100" />
        </button>
      ))}
    </div>
  );
}
