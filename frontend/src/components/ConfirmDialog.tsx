"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AlertTriangle } from "lucide-react";

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  // Reds the confirm button + uses a warning icon. Use for irreversible actions.
  destructive?: boolean;
}

type Confirm = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Confirm | null>(null);

export function useConfirm(): Confirm {
  const fn = useContext(ConfirmContext);
  if (!fn) throw new Error("useConfirm must be used within ConfirmProvider");
  return fn;
}

interface PendingState {
  options: ConfirmOptions;
  resolve: (v: boolean) => void;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingState | null>(null);

  const confirm = useCallback<Confirm>((options) => {
    return new Promise<boolean>((resolve) => {
      setPending({ options, resolve });
    });
  }, []);

  const close = useCallback(
    (value: boolean) => {
      if (!pending) return;
      pending.resolve(value);
      setPending(null);
    },
    [pending],
  );

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <ConfirmDialogUI
          options={pending.options}
          onConfirm={() => close(true)}
          onCancel={() => close(false)}
        />
      )}
    </ConfirmContext.Provider>
  );
}

interface UIProps {
  options: ConfirmOptions;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialogUI({ options, onConfirm, onCancel }: UIProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Default focus on cancel — safer for destructive prompts.
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      } else if (e.key === "Enter") {
        // Enter triggers confirm only when focus is not on cancel button.
        if (document.activeElement !== cancelRef.current) {
          e.preventDefault();
          onConfirm();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel, onConfirm]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl p-6 space-y-5"
      >
        <div className="flex items-start gap-3">
          {options.destructive && (
            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-400 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
          )}
          <div className="space-y-1.5 min-w-0 flex-1">
            {options.title && (
              <h2 className="text-lg font-bold text-white leading-tight">{options.title}</h2>
            )}
            <p className="text-sm text-[var(--color-muted)] leading-relaxed whitespace-pre-line break-words">
              {options.message}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-[var(--color-muted)] hover:text-white hover:border-white/30 text-sm font-medium transition-colors"
          >
            {options.cancelLabel ?? "취소"}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={
              options.destructive
                ? "px-4 py-2 rounded-lg bg-red-500/90 hover:bg-red-500 text-white text-sm font-bold transition-colors"
                : "px-4 py-2 rounded-lg bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-sm font-bold transition-colors"
            }
          >
            {options.confirmLabel ?? "확인"}
          </button>
        </div>
      </div>
    </div>
  );
}
