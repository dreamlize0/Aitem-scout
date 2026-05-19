"use client";

import { SyntheticEvent, useEffect, useState } from "react";
import {
  FolderArchive,
  FolderPlus,
  Loader2,
  Sparkles,
  X,
  AlertTriangle,
  Check,
} from "lucide-react";
import {
  ApiClientError,
  createProject,
  fetchProjects,
  isSupabaseConfigured,
  saveItems,
} from "@/lib/api";
import type { Project, ReportItem } from "@/lib/types";

interface Props {
  item: ReportItem;
  onClose: () => void;
  onSaved?: (project: Project) => void;
}

type Phase = "loading" | "list" | "creating" | "saving" | "done" | "error";

export default function SaveToFolderModal({ item, onClose, onSaved }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [savedProject, setSavedProject] = useState<Project | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!isSupabaseConfigured) {
      setError("Supabase 환경변수가 설정되지 않아 보관함을 사용할 수 없습니다 (.env.local).");
      setPhase("error");
      return;
    }

    fetchProjects()
      .then((items) => {
        if (cancelled) return;
        setProjects(items);
        setPhase("list");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(formatError(err, "보관함 로드 중 오류가 발생했습니다."));
        setPhase("error");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSelect = async (project: Project) => {
    if (busyId) return;
    setBusyId(project.id);
    setError(null);
    setPhase("saving");
    try {
      await saveItems(project.id, [item]);
      setSavedProject(project);
      setPhase("done");
      onSaved?.(project);
    } catch (err) {
      setError(formatError(err, "저장에 실패했습니다."));
      setPhase("error");
    } finally {
      setBusyId(null);
    }
  };

  const handleCreateAndSave = async (e: SyntheticEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name || busyId) return;
    setBusyId("__new__");
    setError(null);
    setPhase("saving");
    try {
      const project = await createProject({ name });
      setProjects((prev) => [project, ...prev]);
      await saveItems(project.id, [item]);
      setSavedProject(project);
      setNewName("");
      setPhase("done");
      onSaved?.(project);
    } catch (err) {
      setError(formatError(err, "폴더 생성 또는 저장에 실패했습니다."));
      setPhase("error");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 shadow-2xl space-y-5 relative"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-[var(--color-muted)] hover:text-white rounded-full hover:bg-[var(--color-surface-hover)] transition-colors"
          aria-label="닫기"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="space-y-1.5">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <FolderArchive className="w-5 h-5 text-[var(--color-primary)]" />
            보관함에 저장
          </h2>
          <p className="text-xs text-[var(--color-muted)] line-clamp-2">
            <Sparkles className="inline w-3 h-3 mr-1 -mt-0.5 text-[var(--color-primary)]" />
            {item.title}
          </p>
        </div>

        {phase === "loading" && (
          <div className="flex flex-col items-center gap-2 py-10 text-[var(--color-muted)]">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--color-primary)]" />
            <p className="text-sm">폴더 목록을 불러오는 중…</p>
          </div>
        )}

        {phase === "done" && savedProject && (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <div className="w-12 h-12 rounded-full bg-[var(--color-accent-green)]/15 text-[var(--color-accent-green)] flex items-center justify-center">
              <Check className="w-6 h-6" />
            </div>
            <p className="text-white font-medium">
              <span className="text-[var(--color-primary)]">{savedProject.name}</span>에 저장됨
            </p>
            <button
              onClick={onClose}
              className="mt-2 px-4 py-1.5 rounded-lg bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-sm font-medium transition-colors"
            >
              확인
            </button>
          </div>
        )}

        {(phase === "list" || phase === "saving" || phase === "creating") && (
          <>
            {projects.length > 0 && (
              <div className="space-y-1 max-h-64 overflow-y-auto -mx-1 pr-1">
                {projects.map((p) => {
                  const isBusy = busyId === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => handleSelect(p)}
                      disabled={busyId !== null}
                      className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg hover:bg-[var(--color-surface-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-left group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <FolderArchive className="w-4 h-4 text-[var(--color-primary)] shrink-0" />
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-white truncate">{p.name}</div>
                          <div className="text-xs text-[var(--color-muted)]">
                            아이템 {p.saved_items_count}개
                          </div>
                        </div>
                      </div>
                      {isBusy && <Loader2 className="w-4 h-4 animate-spin text-[var(--color-primary)] shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}

            {projects.length === 0 && phase === "list" && (
              <div className="text-center text-sm text-[var(--color-muted)] py-3">
                아직 폴더가 없습니다. 아래에서 새 폴더를 만들어 저장하세요.
              </div>
            )}

            <form
              onSubmit={handleCreateAndSave}
              className="border-t border-[var(--color-border)] pt-4 space-y-2"
            >
              <label className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider flex items-center gap-1.5">
                <FolderPlus className="w-3.5 h-3.5" /> 새 폴더에 저장
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="예: 골프 채널 기획"
                  disabled={busyId !== null}
                  maxLength={80}
                  className="flex-1 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[var(--color-primary)]/60 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!newName.trim() || busyId !== null}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
                >
                  {busyId === "__new__" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FolderPlus className="w-4 h-4" />
                  )}
                  생성+저장
                </button>
              </div>
            </form>
          </>
        )}

        {phase === "error" && (
          <div className="space-y-3">
            <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-200 break-words">{error}</p>
            </div>
            <button
              onClick={onClose}
              className="w-full px-4 py-2 rounded-lg border border-[var(--color-border)] text-[var(--color-muted)] hover:text-white hover:border-white/30 text-sm font-medium transition-colors"
            >
              닫기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function formatError(err: unknown, fallback: string): string {
  if (err instanceof ApiClientError) return `[${err.code}] ${err.message}`;
  if (err instanceof Error) return err.message;
  return fallback;
}
