"use client";

import { SyntheticEvent, useEffect, useState } from "react";
import Link from "next/link";
import {
  FolderArchive,
  Plus,
  MoreVertical,
  Share2,
  Users,
  Search,
  Loader2,
  AlertTriangle,
  X,
  Check,
  EyeOff,
  Pencil,
  RefreshCw,
  Trash2,
} from "lucide-react";
import {
  ApiClientError,
  createProject,
  deleteProject,
  fetchProjects,
  isSupabaseConfigured,
  updateProject,
} from "@/lib/api";
import type { Project } from "@/lib/types";
import { useConfirm } from "@/components/ConfirmDialog";

const RELATIVE = new Intl.RelativeTimeFormat("ko", { numeric: "auto" });

function formatActionError(err: unknown, fallback: string): string {
  if (err instanceof ApiClientError) return `[${err.code}] ${err.message}`;
  if (err instanceof Error) return err.message;
  return fallback;
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.round(diffMs / 60_000);
  if (min < 1) return "방금 전";
  if (min < 60) return RELATIVE.format(-min, "minute");
  const hr = Math.round(min / 60);
  if (hr < 24) return RELATIVE.format(-hr, "hour");
  const day = Math.round(hr / 24);
  if (day < 7) return RELATIVE.format(-day, "day");
  const wk = Math.round(day / 7);
  if (wk < 5) return RELATIVE.format(-wk, "week");
  return RELATIVE.format(-Math.round(day / 30), "month");
}

export default function StoragePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [busyShareIds, setBusyShareIds] = useState<Set<string>>(new Set());
  const [copiedShareIds, setCopiedShareIds] = useState<Set<string>>(new Set());
  const [shareError, setShareError] = useState<string | null>(null);

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  const confirm = useConfirm();

  useEffect(() => {
    if (!openMenuId) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (!target?.closest("[data-folder-menu]")) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [openMenuId]);

  useEffect(() => {
    let cancelled = false;

    if (!isSupabaseConfigured) {
      setLoading(false);
      setError("Supabase 환경변수가 설정되지 않아 보관함을 불러올 수 없습니다 (.env.local).");
      return;
    }

    fetchProjects()
      .then((items) => {
        if (!cancelled) setProjects(items);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof ApiClientError
            ? `[${err.code}] ${err.message}`
            : err instanceof Error
              ? err.message
              : "보관함 로드 중 오류가 발생했습니다.";
        setError(message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleCreate = async (e: SyntheticEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setCreateBusy(true);
    setCreateError(null);
    try {
      const created = await createProject({ name });
      setProjects((prev) => [created, ...prev]);
      setNewName("");
      setCreating(false);
    } catch (err) {
      const message =
        err instanceof ApiClientError
          ? `[${err.code}] ${err.message}`
          : err instanceof Error
            ? err.message
            : "폴더 생성에 실패했습니다.";
      setCreateError(message);
    } finally {
      setCreateBusy(false);
    }
  };

  const startRename = (folder: Project) => {
    setOpenMenuId(null);
    setRenameId(folder.id);
    setRenameDraft(folder.name);
  };

  const submitRename = async (folder: Project, e: SyntheticEvent) => {
    e.preventDefault();
    const name = renameDraft.trim();
    if (!name || name === folder.name) {
      setRenameId(null);
      return;
    }
    setActionBusyId(folder.id);
    setShareError(null);
    try {
      const updated = await updateProject(folder.id, { name });
      setProjects((prev) => prev.map((p) => (p.id === folder.id ? updated : p)));
      setRenameId(null);
    } catch (err) {
      setShareError(formatActionError(err, "이름 변경에 실패했습니다."));
    } finally {
      setActionBusyId(null);
    }
  };

  const regenerateToken = async (folder: Project) => {
    setOpenMenuId(null);
    const ok = await confirm({
      title: "공유 토큰 재발급",
      message: `‘${folder.name}’의 토큰을 재발급하면 기존 공유 링크가 즉시 무효화됩니다. 계속할까요?`,
      confirmLabel: "재발급",
      destructive: true,
    });
    if (!ok) return;
    setActionBusyId(folder.id);
    setShareError(null);
    try {
      const updated = await updateProject(folder.id, { regenerate_share_token: true });
      setProjects((prev) => prev.map((p) => (p.id === folder.id ? updated : p)));
      if (updated.share_url) await copyShare(updated);
    } catch (err) {
      setShareError(formatActionError(err, "토큰 재발급에 실패했습니다."));
    } finally {
      setActionBusyId(null);
    }
  };

  const removeFolder = async (folder: Project) => {
    setOpenMenuId(null);
    const ok = await confirm({
      title: "폴더 삭제",
      message: `‘${folder.name}’과 저장된 모든 아이템이 영구 삭제됩니다. 정말 삭제할까요?`,
      confirmLabel: "삭제",
      destructive: true,
    });
    if (!ok) return;
    setActionBusyId(folder.id);
    setShareError(null);
    try {
      await deleteProject(folder.id);
      setProjects((prev) => prev.filter((p) => p.id !== folder.id));
    } catch (err) {
      setShareError(formatActionError(err, "폴더 삭제에 실패했습니다."));
    } finally {
      setActionBusyId(null);
    }
  };

  const filtered = query.trim()
    ? projects.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()))
    : projects;

  const copyShare = async (p: Project) => {
    if (!p.share_url) return;
    // Backend returns absolute URL when SITE_URL is set, otherwise a relative
    // path. Join with the current origin for a clipboard-ready link either way.
    const absolute = p.share_url.startsWith("http")
      ? p.share_url
      : `${window.location.origin}${p.share_url}`;
    try {
      await navigator.clipboard.writeText(absolute);
      setCopiedShareIds((prev) => {
        const next = new Set(prev);
        next.add(p.id);
        return next;
      });
      setTimeout(() => {
        setCopiedShareIds((prev) => {
          const next = new Set(prev);
          next.delete(p.id);
          return next;
        });
      }, 2000);
    } catch {
      /* clipboard 권한 없는 경우 — 알림은 토스트 미구현, 일단 무시 */
    }
  };

  const toggleShare = async (folder: Project) => {
    if (busyShareIds.has(folder.id)) return;
    // Disabling share permanently invalidates any link already sent out.
    if (folder.share_enabled) {
      const ok = await confirm({
        title: "공유 비활성화",
        message: `‘${folder.name}’의 공유를 비활성화하면 이미 보낸 링크가 즉시 무효화됩니다. 계속할까요?`,
        confirmLabel: "비활성화",
        destructive: true,
      });
      if (!ok) return;
    }
    setShareError(null);
    setBusyShareIds((prev) => {
      const next = new Set(prev);
      next.add(folder.id);
      return next;
    });
    try {
      const updated = await updateProject(folder.id, { share_enabled: !folder.share_enabled });
      setProjects((prev) => prev.map((p) => (p.id === folder.id ? updated : p)));
      // Newly enabled → auto-copy the freshly minted link.
      if (updated.share_enabled && updated.share_url) {
        await copyShare(updated);
      }
    } catch (err) {
      const message =
        err instanceof ApiClientError
          ? `[${err.code}] ${err.message}`
          : err instanceof Error
            ? err.message
            : "공유 설정 변경에 실패했습니다.";
      setShareError(message);
    } finally {
      setBusyShareIds((prev) => {
        const next = new Set(prev);
        next.delete(folder.id);
        return next;
      });
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto">
      <header className="h-16 border-b border-[var(--color-border)] bg-[var(--color-background)]/80 backdrop-blur-sm flex items-center justify-between px-8 sticky top-0 z-10 shrink-0">
        <div className="flex items-center gap-2 font-bold text-lg">
          <FolderArchive className="w-5 h-5 text-[var(--color-primary)]" />
          내 보관함
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="w-4 h-4 text-[var(--color-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="폴더 검색"
              className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-full pl-9 pr-4 py-1.5 text-sm text-white outline-none focus:border-[var(--color-primary)]/50 transition-colors"
            />
          </div>
          <button
            onClick={() => setCreating((v) => !v)}
            className="flex items-center gap-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white px-4 py-1.5 rounded-full text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />새 폴더
          </button>
        </div>
      </header>

      <div className="p-8 space-y-6">
        {shareError && (
          <div className="bg-red-500/5 border border-red-500/20 rounded-xl px-4 py-3 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-200 break-words flex-1">{shareError}</p>
            <button
              onClick={() => setShareError(null)}
              className="text-[var(--color-muted)] hover:text-white shrink-0"
              aria-label="닫기"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {creating && (
          <form
            onSubmit={handleCreate}
            className="bg-[var(--color-surface)] border border-[var(--color-primary)]/40 rounded-2xl p-4 flex flex-col md:flex-row md:items-center gap-3"
          >
            <input
              autoFocus
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="새 폴더 이름 (예: 골프 채널 기획)"
              className="flex-1 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[var(--color-primary)]/60"
              maxLength={80}
            />
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={createBusy || !newName.trim()}
                className="inline-flex items-center gap-1 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {createBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                생성
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreating(false);
                  setNewName("");
                  setCreateError(null);
                }}
                className="inline-flex items-center gap-1 text-[var(--color-muted)] hover:text-white px-3 py-2 rounded-lg text-sm transition-colors"
              >
                <X className="w-4 h-4" />
                취소
              </button>
            </div>
            {createError && (
              <span className="text-xs text-red-300 md:ml-3 break-words">{createError}</span>
            )}
          </form>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-[var(--color-muted)]">
            <Loader2 className="w-7 h-7 animate-spin text-[var(--color-primary)]" />
            <p className="text-sm">보관함을 불러오는 중…</p>
          </div>
        )}

        {!loading && error && (
          <div className="bg-[var(--color-surface)] border border-red-500/30 rounded-2xl p-6 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="font-bold text-white">보관함을 표시할 수 없습니다</h3>
              <p className="text-sm text-[var(--color-muted)] break-words">{error}</p>
            </div>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="bg-[var(--color-surface)] border border-dashed border-[var(--color-border)] rounded-2xl p-12 text-center space-y-3">
            <FolderArchive className="w-10 h-10 mx-auto text-[var(--color-muted)] opacity-50" />
            <h3 className="text-lg font-bold text-white">
              {projects.length === 0 ? "아직 폴더가 없습니다" : "검색 결과가 없습니다"}
            </h3>
            <p className="text-sm text-[var(--color-muted)]">
              {projects.length === 0
                ? "AI가 발굴한 아이템을 프로젝트별로 모아두세요. 우상단 ‘새 폴더’로 시작할 수 있습니다."
                : "다른 키워드로 검색해 보세요."}
            </p>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filtered.map((folder) => (
              <div
                key={folder.id}
                className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 hover:border-[var(--color-primary)]/50 transition-colors group relative"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 rounded-xl bg-[var(--color-primary)]/10 flex items-center justify-center text-[var(--color-primary)] group-hover:scale-110 transition-transform">
                    <FolderArchive className="w-6 h-6" />
                  </div>
                  <div className="relative" data-folder-menu>
                    <button
                      type="button"
                      onClick={() => setOpenMenuId(openMenuId === folder.id ? null : folder.id)}
                      disabled={actionBusyId === folder.id}
                      className="text-[var(--color-muted)] hover:text-white disabled:opacity-40 transition-colors p-1 rounded-md hover:bg-[var(--color-surface-hover)]"
                      aria-label="더보기"
                    >
                      {actionBusyId === folder.id ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <MoreVertical className="w-5 h-5" />
                      )}
                    </button>
                    {openMenuId === folder.id && (
                      <div className="absolute right-0 mt-2 w-52 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-2xl z-20 py-1 overflow-hidden">
                        <button
                          type="button"
                          onClick={() => startRename(folder)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-200 hover:bg-[var(--color-surface-hover)] transition-colors text-left"
                        >
                          <Pencil className="w-4 h-4 text-[var(--color-muted)]" />
                          이름 변경
                        </button>
                        <button
                          type="button"
                          onClick={() => regenerateToken(folder)}
                          disabled={!folder.share_enabled}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-200 hover:bg-[var(--color-surface-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-left"
                          title={folder.share_enabled ? "공유 토큰 재발급" : "먼저 공유를 활성화하세요"}
                        >
                          <RefreshCw className="w-4 h-4 text-[var(--color-muted)]" />
                          공유 토큰 재발급
                        </button>
                        <div className="border-t border-[var(--color-border)] my-1" />
                        <button
                          type="button"
                          onClick={() => removeFolder(folder)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-300 hover:bg-red-500/10 hover:text-red-200 transition-colors text-left"
                        >
                          <Trash2 className="w-4 h-4" />
                          폴더 삭제
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {renameId === folder.id ? (
                  <form
                    onSubmit={(e) => submitRename(folder, e)}
                    className="mb-1 flex gap-2"
                  >
                    <input
                      autoFocus
                      type="text"
                      value={renameDraft}
                      onChange={(e) => setRenameDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          e.preventDefault();
                          setRenameId(null);
                        }
                      }}
                      maxLength={80}
                      disabled={actionBusyId === folder.id}
                      className="flex-1 bg-[var(--color-background)] border border-[var(--color-primary)]/60 rounded-lg px-3 py-1.5 text-white text-base outline-none focus:border-[var(--color-primary)] min-w-0"
                    />
                    <button
                      type="submit"
                      disabled={actionBusyId === folder.id || !renameDraft.trim()}
                      className="inline-flex items-center gap-1 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                    >
                      {actionBusyId === folder.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRenameId(null)}
                      className="text-[var(--color-muted)] hover:text-white px-2 transition-colors"
                      aria-label="취소"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </form>
                ) : (
                  <Link href={`/storage/${folder.id}`} className="block">
                    <h3 className="text-xl font-bold text-white mb-1 group-hover:text-[var(--color-primary)] transition-colors line-clamp-1 cursor-pointer">
                      {folder.name}
                    </h3>
                  </Link>
                )}
                <p className="text-[var(--color-muted)] text-sm mb-6">
                  저장된 아이템 {folder.saved_items_count}개 • {timeAgo(folder.updated_at)} 수정
                </p>

                <div className="flex items-center justify-between pt-4 border-t border-[var(--color-border)]">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleShare(folder);
                    }}
                    disabled={busyShareIds.has(folder.id)}
                    title={folder.share_enabled ? "공유 비활성화" : "공유 활성화 후 링크 자동 복사"}
                    className={
                      folder.share_enabled
                        ? "flex items-center gap-1.5 text-xs font-medium text-[var(--color-accent-green)] bg-[var(--color-accent-green)]/10 hover:bg-[var(--color-accent-green)]/20 px-2.5 py-1 rounded-md transition-colors disabled:opacity-50"
                        : "flex items-center gap-1.5 text-xs font-medium text-[var(--color-muted)] bg-[var(--color-surface-hover)] hover:text-white hover:bg-[var(--color-surface-hover)]/80 px-2.5 py-1 rounded-md transition-colors disabled:opacity-50"
                    }
                  >
                    {busyShareIds.has(folder.id) ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : folder.share_enabled ? (
                      <Users className="w-3.5 h-3.5" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5" />
                    )}
                    {folder.share_enabled ? "공유 중" : "나만 보기"}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      copyShare(folder);
                    }}
                    disabled={!folder.share_url}
                    className="flex items-center gap-1 text-[var(--color-muted)] hover:text-[var(--color-primary)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-xs"
                    title={folder.share_url ? "공유 링크 복사" : "공유가 비활성화된 폴더입니다"}
                  >
                    {copiedShareIds.has(folder.id) ? (
                      <>
                        <Check className="w-4 h-4 text-[var(--color-accent-green)]" />
                        <span className="text-[var(--color-accent-green)]">복사됨</span>
                      </>
                    ) : (
                      <Share2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
