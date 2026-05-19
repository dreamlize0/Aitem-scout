"use client";

import { useState } from "react";
import {
  Check,
  ClipboardCopy,
  Loader2,
  Mail,
  MessageSquare,
  FileText,
  Sparkles,
  X,
  AlertTriangle,
} from "lucide-react";
import { ApiClientError, generateColdContact, isSupabaseConfigured } from "@/lib/api";
import type { ColdContactKind, ReportItem, SearchFilters } from "@/lib/types";

interface Props {
  item: ReportItem;
  // Pass the current search target so the LLM can tailor the pitch — optional.
  target?: SearchFilters["target"];
  onClose: () => void;
}

const KIND_OPTIONS: Array<{
  kind: ColdContactKind;
  label: string;
  description: string;
  icon: React.ReactNode;
}> = [
  {
    kind: "email",
    label: "섭외 메일",
    description: "정중한 비즈니스 톤 (300~500자)",
    icon: <Mail className="w-5 h-5" />,
  },
  {
    kind: "dm",
    label: "DM (인스타/스레드)",
    description: "친근하고 짧게 (150~250자)",
    icon: <MessageSquare className="w-5 h-5" />,
  },
  {
    kind: "proposal",
    label: "제안서 초안",
    description: "구조화된 markdown (500~900자)",
    icon: <FileText className="w-5 h-5" />,
  },
];

export default function ColdContactModal({ item, target, onClose }: Props) {
  const [kind, setKind] = useState<ColdContactKind>("email");
  const [creatorNote, setCreatorNote] = useState("");
  const [draft, setDraft] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const configMissing = !isSupabaseConfigured;

  const handleGenerate = async () => {
    if (configMissing) {
      setError("Supabase 환경변수가 설정되지 않아 콜드 컨택을 생성할 수 없습니다 (.env.local).");
      return;
    }
    setGenerating(true);
    setError(null);
    setDraft(null);
    setCopied(false);
    try {
      const res = await generateColdContact({
        kind,
        item: {
          title: item.title,
          summary: item.summary,
          source_url: item.source_url,
          source_platform: item.source_platform,
          metadata: item.metadata,
        },
        target_audience: target,
        creator_note: creatorNote.trim() || undefined,
      });
      setDraft(res.draft);
    } catch (err) {
      const message =
        err instanceof ApiClientError
          ? `[${err.code}] ${err.message}`
          : err instanceof Error
            ? err.message
            : "알 수 없는 오류가 발생했습니다.";
      setError(message);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard 권한 없을 때는 사용자에게 직접 선택 복사하도록 안내. textarea의
      // 텍스트를 그대로 보여주므로 별도 fallback UI 불필요.
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-6 border-b border-[var(--color-border)]">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-white font-bold text-lg">
              <Sparkles className="w-5 h-5 text-[var(--color-primary)]" />
              AI 콜드 컨택 초안
            </h2>
            <p className="text-xs text-[var(--color-muted)] mt-1 truncate">
              대상: <span className="text-white">{item.title}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="p-1.5 text-[var(--color-muted)] hover:text-white transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {configMissing && (
            <div className="text-xs text-amber-300/90 bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2 flex gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Supabase가 설정되지 않아 콜드 컨택은 비활성화됩니다. <code className="font-mono">.env.local</code>
                에 키를 추가하세요.
              </span>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-bold text-[var(--color-muted)] uppercase tracking-wider">
              종류 선택
            </label>
            <div className="grid grid-cols-3 gap-2">
              {KIND_OPTIONS.map((opt) => {
                const active = kind === opt.kind;
                return (
                  <button
                    key={opt.kind}
                    type="button"
                    onClick={() => setKind(opt.kind)}
                    className={`flex flex-col items-start gap-1 px-3 py-3 rounded-xl border text-left transition-colors ${
                      active
                        ? "bg-[var(--color-primary)]/10 border-[var(--color-primary)]/50 text-white"
                        : "bg-[var(--color-background)]/40 border-[var(--color-border)] text-[var(--color-muted)] hover:border-white/20 hover:text-white"
                    }`}
                  >
                    <span className={active ? "text-[var(--color-primary)]" : ""}>{opt.icon}</span>
                    <span className="text-sm font-bold">{opt.label}</span>
                    <span className="text-[10px] text-[var(--color-muted)] leading-tight">
                      {opt.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="cold-contact-note"
              className="text-xs font-bold text-[var(--color-muted)] uppercase tracking-wider"
            >
              크리에이터 메모 <span className="text-[var(--color-muted)]/60 normal-case font-normal">(선택)</span>
            </label>
            <textarea
              id="cold-contact-note"
              value={creatorNote}
              onChange={(e) => setCreatorNote(e.target.value.slice(0, 500))}
              placeholder="예: '주말 야간 촬영 가능 여부 확인', '협찬보다 방문 촬영 위주로 제안'"
              rows={2}
              className="w-full bg-[var(--color-background)]/40 border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-white placeholder-[var(--color-muted)]/60 outline-none focus:border-[var(--color-primary)]/50 transition-colors resize-none"
            />
            <div className="flex justify-end text-[10px] text-[var(--color-muted)]/70 tabular-nums">
              {creatorNote.length}/500
            </div>
          </div>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || configMissing}
            className="w-full flex items-center justify-center gap-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold px-4 py-3 rounded-xl transition-colors"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {generating ? "AI 초안 작성 중..." : draft ? "다시 생성" : "초안 생성"}
          </button>

          {error && (
            <div className="text-xs text-red-300 bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2 break-words">
              {error}
            </div>
          )}

          {draft !== null && !generating && (
            <div className="space-y-2 animate-in fade-in duration-300">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="cold-contact-draft"
                  className="text-xs font-bold text-[var(--color-muted)] uppercase tracking-wider"
                >
                  생성된 초안
                </label>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1.5 text-xs text-[var(--color-muted)] hover:text-white px-2.5 py-1 border border-[var(--color-border)] hover:border-white/20 rounded-md transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-[var(--color-accent-green)]" /> : <ClipboardCopy className="w-3.5 h-3.5" />}
                  {copied ? "복사됨" : "복사"}
                </button>
              </div>
              <textarea
                id="cold-contact-draft"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={Math.min(20, Math.max(8, draft.split("\n").length + 1))}
                className="w-full bg-[var(--color-background)]/40 border border-[var(--color-border)] rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-[var(--color-primary)]/50 transition-colors font-mono leading-relaxed"
              />
              <p className="text-[10px] text-[var(--color-muted)]/70 leading-relaxed">
                초안은 자유롭게 수정 가능합니다. 사실 정보(상호명·담당자명·날짜 등)는 실제 정보로 바꿔서 발송하세요.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
