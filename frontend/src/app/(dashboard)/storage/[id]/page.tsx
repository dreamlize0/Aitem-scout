"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  FolderArchive,
  AlertTriangle,
  Loader2,
  Sparkles,
  Users,
  EyeOff,
  Share2,
  Check,
  Trash2,
  X,
} from "lucide-react";
import SearchResultCard from "@/components/SearchResultCard";
import ReportDetailPanel from "@/components/ReportDetailPanel";
import {
  ApiClientError,
  deleteSavedItem,
  fetchProject,
  fetchSavedItems,
  isSupabaseConfigured,
  updateProject,
} from "@/lib/api";
import { savedItemToReportItem } from "@/lib/types";
import type { Project, ReportItem, SavedItem } from "@/lib/types";
import { useAuth } from "@/lib/useAuth";
import { useConfirm } from "@/components/ConfirmDialog";

interface PageProps {
  params: Promise<{ id: string }>;
}

function formatError(err: unknown, fallback: string): string {
  if (err instanceof ApiClientError) return `[${err.code}] ${err.message}`;
  if (err instanceof Error) return err.message;
  return fallback;
}

export default function FolderDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const { user } = useAuth();

  const [project, setProject] = useState<Project | null>(null);
  const [items, setItems] = useState<SavedItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [shareBusy, setShareBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const confirm = useConfirm();

  useEffect(() => {
    let cancelled = false;

    if (!isSupabaseConfigured) {
      setLoading(false);
      setError("Supabase 환경변수가 설정되지 않아 보관함을 불러올 수 없습니다 (.env.local).");
      return;
    }

    Promise.all([fetchProject(id), fetchSavedItems(id)])
      .then(([p, list]) => {
        if (cancelled) return;
        setProject(p);
        setItems(list);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(formatError(err, "폴더를 불러오지 못했습니다."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  const copyShareUrl = async (p: Project) => {
    if (!p.share_url) return;
    const absolute = p.share_url.startsWith("http")
      ? p.share_url
      : `${window.location.origin}${p.share_url}`;
    try {
      await navigator.clipboard.writeText(absolute);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard 권한 없음 — 토스트 미구현 */
    }
  };

  const toggleShare = async () => {
    if (!project || shareBusy) return;
    if (project.share_enabled) {
      const ok = await confirm({
        title: "공유 비활성화",
        message: `‘${project.name}’의 공유를 비활성화하면 이미 보낸 링크가 즉시 무효화됩니다. 계속할까요?`,
        confirmLabel: "비활성화",
        destructive: true,
      });
      if (!ok) return;
    }
    setShareBusy(true);
    setActionError(null);
    try {
      const updated = await updateProject(project.id, { share_enabled: !project.share_enabled });
      setProject(updated);
      if (updated.share_enabled && updated.share_url) {
        await copyShareUrl(updated);
      }
    } catch (err) {
      setActionError(formatError(err, "공유 설정 변경에 실패했습니다."));
    } finally {
      setShareBusy(false);
    }
  };

  const removeItem = async (item: SavedItem) => {
    const ok = await confirm({
      title: "아이템 삭제",
      message: `‘${item.title}’을(를) 폴더에서 삭제합니다. 계속할까요?`,
      confirmLabel: "삭제",
      destructive: true,
    });
    if (!ok) return;
    setDeletingId(item.id);
    setActionError(null);
    try {
      await deleteSavedItem(item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      if (selectedId === item.id) setSelectedId(null);
    } catch (err) {
      setActionError(formatError(err, "아이템 삭제에 실패했습니다."));
    } finally {
      setDeletingId(null);
    }
  };

  const selectedItem: ReportItem | null =
    items.find((i) => i.id === selectedId) ? savedItemToReportItem(items.find((i) => i.id === selectedId)!) : null;

  return (
    <>
      <header className="h-16 border-b border-[var(--color-border)] bg-[var(--color-background)]/80 backdrop-blur-sm flex items-center justify-between px-8 sticky top-0 z-10 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/storage"
            className="p-1.5 text-[var(--color-muted)] hover:text-white hover:bg-[var(--color-surface-hover)] rounded-md transition-colors shrink-0"
            aria-label="보관함으로"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <FolderArchive className="w-5 h-5 text-[var(--color-primary)] shrink-0" />
          <h1 className="font-bold text-lg text-white truncate">
            {project?.name ?? (loading ? "로딩 중…" : "폴더")}
          </h1>
          {project && (
            <span className="text-xs text-[var(--color-muted)] bg-[var(--color-surface-hover)] px-2 py-0.5 rounded-md shrink-0">
              아이템 {items.length}개
            </span>
          )}
        </div>

        {project && user && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={toggleShare}
              disabled={shareBusy}
              title={project.share_enabled ? "공유 비활성화" : "공유 활성화 후 링크 자동 복사"}
              className={
                project.share_enabled
                  ? "flex items-center gap-1.5 text-xs font-medium text-[var(--color-accent-green)] bg-[var(--color-accent-green)]/10 hover:bg-[var(--color-accent-green)]/20 px-2.5 py-1 rounded-md transition-colors disabled:opacity-50"
                  : "flex items-center gap-1.5 text-xs font-medium text-[var(--color-muted)] bg-[var(--color-surface-hover)] hover:text-white px-2.5 py-1 rounded-md transition-colors disabled:opacity-50"
              }
            >
              {shareBusy ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : project.share_enabled ? (
                <Users className="w-3.5 h-3.5" />
              ) : (
                <EyeOff className="w-3.5 h-3.5" />
              )}
              {project.share_enabled ? "공유 중" : "나만 보기"}
            </button>
            <button
              type="button"
              onClick={() => copyShareUrl(project)}
              disabled={!project.share_url}
              className="flex items-center gap-1 text-xs text-[var(--color-muted)] hover:text-[var(--color-primary)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors px-2 py-1"
              title={project.share_url ? "공유 링크 복사" : "공유가 비활성화된 폴더입니다"}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-[var(--color-accent-green)]" />
                  <span className="text-[var(--color-accent-green)]">복사됨</span>
                </>
              ) : (
                <Share2 className="w-4 h-4" />
              )}
            </button>
          </div>
        )}
      </header>

      <div className="flex-1 overflow-hidden relative">
        {loading && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-[var(--color-muted)]">
            <Loader2 className="w-7 h-7 animate-spin text-[var(--color-primary)]" />
            <p className="text-sm">폴더를 불러오는 중…</p>
          </div>
        )}

        {!loading && error && (
          <div className="h-full flex items-center justify-center p-8">
            <div className="max-w-md w-full bg-[var(--color-surface)] border border-red-500/30 rounded-2xl p-6 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h3 className="font-bold text-white">폴더를 표시할 수 없습니다</h3>
                <p className="text-sm text-[var(--color-muted)] break-words">{error}</p>
                <Link
                  href="/storage"
                  className="inline-block mt-3 text-sm text-[var(--color-primary)] hover:underline"
                >
                  ← 보관함으로 돌아가기
                </Link>
              </div>
            </div>
          </div>
        )}

        {!loading && !error && project && (
          <div className="flex h-full">
            <div className="flex-1 overflow-y-auto p-8">
              <div className="max-w-3xl mx-auto space-y-6">
                {actionError && (
                  <div className="bg-red-500/5 border border-red-500/20 rounded-xl px-4 py-3 flex items-start gap-3">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <p className="text-sm text-red-200 flex-1 break-words">{actionError}</p>
                    <button
                      onClick={() => setActionError(null)}
                      className="text-[var(--color-muted)] hover:text-white shrink-0"
                      aria-label="닫기"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {items.length === 0 && (
                  <div className="bg-[var(--color-surface)] border border-dashed border-[var(--color-border)] rounded-2xl p-12 text-center space-y-3">
                    <Sparkles className="w-10 h-10 mx-auto text-[var(--color-muted)] opacity-40" />
                    <h3 className="text-lg font-bold text-white">아직 저장된 아이템이 없습니다</h3>
                    <p className="text-sm text-[var(--color-muted)]">
                      검색 결과의 추천 아이템에서 ‘보관함 저장’으로 추가할 수 있습니다.
                    </p>
                    <Link
                      href="/"
                      className="inline-block mt-2 px-4 py-2 rounded-lg bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-sm font-medium transition-colors"
                    >
                      AI 검색 시작
                    </Link>
                  </div>
                )}

                {items.length > 0 && (
                  <div className="space-y-4">
                    {items.map((it) => {
                      const reportItem = savedItemToReportItem(it);
                      return (
                        <div key={it.id} className="relative">
                          <SearchResultCard
                            item={reportItem}
                            isSelected={selectedId === it.id}
                            onClick={() => setSelectedId(it.id)}
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeItem(it);
                            }}
                            disabled={deletingId === it.id}
                            title="폴더에서 삭제"
                            className="absolute top-3 right-3 p-1.5 bg-black/40 hover:bg-red-500/20 text-[var(--color-muted)] hover:text-red-300 disabled:opacity-30 rounded-md transition-colors"
                          >
                            {deletingId === it.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {selectedItem ? (
              <div className="w-[480px] shrink-0 h-full relative border-l border-[var(--color-border)]">
                <button
                  onClick={() => setSelectedId(null)}
                  className="absolute top-6 right-6 p-2 bg-black/50 hover:bg-black/80 rounded-full text-white z-10 transition-colors"
                  aria-label="패널 닫기"
                >
                  <X className="w-5 h-5" />
                </button>
                <ReportDetailPanel
                  key={selectedItem.id}
                  item={selectedItem}
                  enableActions={false}
                />
              </div>
            ) : (
              items.length > 0 && (
                <div className="w-[480px] shrink-0 h-full bg-[var(--color-surface)] border-l border-[var(--color-border)] flex items-center justify-center p-8 text-center text-[var(--color-muted)]">
                  <div className="space-y-4">
                    <Sparkles className="w-12 h-12 mx-auto opacity-20" />
                    <p>
                      좌측에서 아이템을 선택하면
                      <br />
                      상세 정보가 표시됩니다.
                    </p>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </>
  );
}
