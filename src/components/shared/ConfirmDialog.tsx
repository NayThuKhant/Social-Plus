"use client";

import { create } from "zustand";

type Options = {
  title: string;
  message?: string;
  confirmLabel?: string;
  danger?: boolean;
};

type Store = {
  open: boolean;
  options: Options;
  resolve: ((v: boolean) => void) | null;
  show: (opts: Options) => Promise<boolean>;
  _resolve: (v: boolean) => void;
};

export const useConfirm = create<Store>((set, get) => ({
  open: false,
  options: { title: "" },
  resolve: null,
  show: (opts) =>
    new Promise<boolean>((res) => {
      set({ open: true, options: opts, resolve: res });
    }),
  _resolve: (v) => {
    get().resolve?.(v);
    set({ open: false, resolve: null });
  },
}));

export function ConfirmDialog() {
  const { open, options, _resolve } = useConfirm();
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4"
      onClick={() => _resolve(false)}
    >
      <div
        className="bg-[var(--background)] rounded-2xl w-full max-w-xs shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-4">
          <h2 className="font-bold text-lg text-center">{options.title}</h2>
          {options.message && (
            <p className="text-[var(--muted)] text-sm text-center mt-1.5">{options.message}</p>
          )}
        </div>
        <div className="flex border-t border-[var(--border)]">
          <button
            onClick={() => _resolve(false)}
            className="flex-1 py-3.5 text-sm font-medium hover:bg-[var(--hover)] transition-colors border-r border-[var(--border)]"
          >
            Cancel
          </button>
          <button
            onClick={() => _resolve(true)}
            className={`flex-1 py-3.5 text-sm font-bold hover:bg-[var(--hover)] transition-colors ${
              options.danger ? "text-red-500" : "text-[var(--accent)]"
            }`}
          >
            {options.confirmLabel ?? "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
