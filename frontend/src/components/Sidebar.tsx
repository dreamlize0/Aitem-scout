"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Search,
  Sparkles,
  FolderArchive,
  Settings,
  Folder,
  Loader2,
} from "lucide-react";
import { useSearchStore } from "@/store/useSearchStore";
import { fetchProjects, isSupabaseConfigured } from "@/lib/api";
import { PROJECTS_CHANGED_EVENT } from "@/lib/projectsEvents";
import { useAuth } from "@/lib/useAuth";
import type { Project } from "@/lib/types";

export default function Sidebar() {
  const pathname = usePathname();
  const resetSearch = useSearchStore((state) => state.resetSearch);
  const { user } = useAuth();

  const searchActive = pathname === "/";
  const storageActive = pathname?.startsWith("/storage") ?? false;
  const settingsActive = pathname === "/settings";

  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  const loadProjects = useCallback(async () => {
    if (!isSupabaseConfigured || !user) {
      setProjects([]);
      return;
    }
    setLoadingProjects(true);
    try {
      const list = await fetchProjects();
      setProjects(list);
    } catch {
      // Sidebar shouldn't surface errors; storage page will show details if it fails too.
    } finally {
      setLoadingProjects(false);
    }
  }, [user]);

  useEffect(() => {
    loadProjects();
    const handler = () => loadProjects();
    window.addEventListener(PROJECTS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(PROJECTS_CHANGED_EVENT, handler);
  }, [loadProjects]);

  return (
    <aside className="w-64 border-r border-[var(--color-border)] bg-[var(--color-surface)] p-6 flex-col gap-8 hidden md:flex shrink-0 h-screen sticky top-0">
      <Link
        href="/"
        onClick={resetSearch}
        className="flex items-center gap-2 text-[var(--color-primary)] font-bold text-xl cursor-pointer"
      >
        <Sparkles className="w-6 h-6" />
        AItem Scout
      </Link>

      <nav className="flex flex-col gap-2">
        <Link
          href="/"
          onClick={resetSearch}
          className={`flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition-colors ${searchActive ? 'bg-[var(--color-surface-hover)] text-white' : 'text-[var(--color-muted)] hover:text-white hover:bg-[var(--color-surface-hover)]'}`}
        >
          <Search className={`w-5 h-5 ${searchActive ? 'text-[var(--color-primary)]' : ''}`} />
          AI 통합 검색
        </Link>
        <Link
          href="/storage"
          className={`flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition-colors ${storageActive ? 'bg-[var(--color-surface-hover)] text-white' : 'text-[var(--color-muted)] hover:text-white hover:bg-[var(--color-surface-hover)]'}`}
        >
          <FolderArchive className={`w-5 h-5 ${storageActive ? 'text-[var(--color-primary)]' : ''}`} />
          내 보관함
        </Link>
        <Link
          href="/settings"
          className={`flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition-colors ${settingsActive ? 'bg-[var(--color-surface-hover)] text-white' : 'text-[var(--color-muted)] hover:text-white hover:bg-[var(--color-surface-hover)]'}`}
        >
          <Settings className={`w-5 h-5 ${settingsActive ? 'text-[var(--color-primary)]' : ''}`} />
          설정
        </Link>
      </nav>

      {user && (
        <div className="flex flex-col gap-2 min-h-0 flex-1">
          <div className="flex items-center justify-between px-3">
            <h4 className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">
              내 폴더
            </h4>
            {loadingProjects && (
              <Loader2 className="w-3 h-3 animate-spin text-[var(--color-muted)]" />
            )}
          </div>

          <div className="flex flex-col gap-1 overflow-y-auto -mx-1 px-1 min-h-0">
            {!loadingProjects && projects.length === 0 && (
              <p className="text-xs text-[var(--color-muted)]/70 px-3 py-2 leading-relaxed">
                아직 폴더가 없습니다.
                <br />
                <Link href="/storage" className="text-[var(--color-primary)] hover:underline">
                  보관함에서 새로 만들기 →
                </Link>
              </p>
            )}

            {projects.map((p) => {
              const isActive = pathname === `/storage/${p.id}`;
              return (
                <Link
                  key={p.id}
                  href={`/storage/${p.id}`}
                  title={p.name}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors min-w-0 ${
                    isActive
                      ? "bg-[var(--color-surface-hover)] text-white"
                      : "text-[var(--color-muted)] hover:text-white hover:bg-[var(--color-surface-hover)]"
                  }`}
                >
                  <Folder
                    className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-[var(--color-primary)]" : ""}`}
                  />
                  <span className="truncate">{p.name}</span>
                  {p.saved_items_count > 0 && (
                    <span className="ml-auto text-[10px] text-[var(--color-muted)]/70 shrink-0 tabular-nums">
                      {p.saved_items_count}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
}
