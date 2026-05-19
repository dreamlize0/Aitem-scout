"use client";

import { Globe, Sliders, Users, Sparkles } from "lucide-react";
import type { SearchFilters as Filters } from "@/lib/types";

interface Props {
  value: Filters;
  onChange: (next: Filters) => void;
}

const THEMES = [
  "가성비",
  "엄마랑 데이트",
  "가족과 함께",
  "혼자만의 시간",
  "인생샷",
  "효도여행",
  "외국인 반응",
  "프리미엄",
];

type Gender = "any" | "female" | "male";
type AgeRange = "any" | "10-20" | "20-30" | "30-40" | "40-50" | "50+";

const GENDERS: Array<{ key: Gender; label: string }> = [
  { key: "any", label: "전체" },
  { key: "female", label: "여성" },
  { key: "male", label: "남성" },
];

const AGES: Array<{ key: AgeRange; label: string }> = [
  { key: "any", label: "전체" },
  { key: "10-20", label: "10대" },
  { key: "20-30", label: "20대" },
  { key: "30-40", label: "30대" },
  { key: "40-50", label: "40대" },
  { key: "50+", label: "50대+" },
];

const LIFESTYLES = ["city", "outdoor", "family", "premium", "budget"];
const LIFESTYLE_LABEL: Record<string, string> = {
  city: "도심",
  outdoor: "야외",
  family: "가족",
  premium: "프리미엄",
  budget: "가성비",
};

const COUNTRIES = [
  { code: "JP", label: "🇯🇵 일본" },
  { code: "US", label: "🇺🇸 미국" },
  { code: "CN", label: "🇨🇳 중국" },
  { code: "TW", label: "🇹🇼 대만" },
  { code: "TH", label: "🇹🇭 태국" },
  { code: "VN", label: "🇻🇳 베트남" },
];

function chip(active: boolean): string {
  return active
    ? "px-3 py-1.5 rounded-full text-xs font-medium border bg-[var(--color-primary)]/10 border-[var(--color-primary)] text-[var(--color-primary)] transition-colors"
    : "px-3 py-1.5 rounded-full text-xs font-medium border border-[var(--color-border)] text-[var(--color-muted)] hover:border-white/20 hover:text-white transition-colors";
}

export default function SearchFilters({ value, onChange }: Props) {
  const themes = value.theme ?? [];
  const target = value.target ?? {};
  const globals = value.global_targets ?? [];

  const toggleTheme = (t: string) => {
    const next = themes.includes(t) ? themes.filter((x) => x !== t) : [...themes, t];
    onChange({ ...value, theme: next });
  };

  const setGender = (g: Gender) => {
    onChange({ ...value, target: { ...target, gender: g } });
  };

  const setAge = (a: AgeRange) => {
    onChange({ ...value, target: { ...target, age_range: a } });
  };

  const setLifestyle = (l: string | undefined) => {
    onChange({ ...value, target: { ...target, lifestyle: l } });
  };

  const toggleCountry = (code: string) => {
    const next = globals.includes(code) ? globals.filter((x) => x !== code) : [...globals, code];
    onChange({ ...value, global_targets: next });
  };

  const activeCount =
    themes.length +
    (target.gender && target.gender !== "any" ? 1 : 0) +
    (target.age_range && target.age_range !== "any" ? 1 : 0) +
    (target.lifestyle ? 1 : 0) +
    globals.length;

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-white font-medium">
          <Sliders className="w-4 h-4 text-[var(--color-muted)]" />
          맞춤 필터
          {activeCount > 0 && (
            <span className="text-xs font-medium text-[var(--color-primary)] bg-[var(--color-primary)]/10 px-2 py-0.5 rounded-md">
              {activeCount}개 적용 중
            </span>
          )}
        </div>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={() =>
              onChange({
                theme: [],
                target: { gender: "any", age_range: "any", lifestyle: undefined },
                global_targets: [],
                locale: value.locale,
              })
            }
            className="text-xs text-[var(--color-muted)] hover:text-white transition-colors"
          >
            초기화
          </button>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" /> 테마
        </label>
        <div className="flex flex-wrap gap-2">
          {THEMES.map((t) => (
            <button key={t} type="button" onClick={() => toggleTheme(t)} className={chip(themes.includes(t))}>
              # {t}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <label className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" /> 시청 타겟
        </label>

        <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-6">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--color-muted)] w-12 shrink-0">성별</span>
            <div className="flex flex-wrap gap-1.5">
              {GENDERS.map((g) => (
                <button
                  key={g.key}
                  type="button"
                  onClick={() => setGender(g.key)}
                  className={chip((target.gender ?? "any") === g.key)}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-[var(--color-muted)] w-12 shrink-0">연령</span>
            <div className="flex flex-wrap gap-1.5">
              {AGES.map((a) => (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => setAge(a.key)}
                  className={chip((target.age_range ?? "any") === a.key)}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-[var(--color-muted)] w-12 shrink-0">라이프</span>
          <div className="flex flex-wrap gap-1.5">
            {LIFESTYLES.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLifestyle(target.lifestyle === l ? undefined : l)}
                className={chip(target.lifestyle === l)}
              >
                {LIFESTYLE_LABEL[l] ?? l}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider flex items-center gap-1.5">
          <Globe className="w-3.5 h-3.5" /> 글로벌 타겟
          <span className="font-normal text-[var(--color-muted)]/70 normal-case tracking-normal">
            (선택 시 해외 트렌드 데이터 추가 수집)
          </span>
        </label>
        <div className="flex flex-wrap gap-2">
          {COUNTRIES.map((c) => (
            <button
              key={c.code}
              type="button"
              onClick={() => toggleCountry(c.code)}
              className={chip(globals.includes(c.code))}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
