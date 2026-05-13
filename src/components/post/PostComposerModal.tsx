"use client";

import { X } from "lucide-react";
import { PostComposer } from "./PostComposer";

type Props = {
  onClose: () => void;
  replyToId?: string;
  quoteOfId?: string;
};

export function PostComposerModal({ onClose, replyToId, quoteOfId }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-[var(--background)] rounded-2xl w-full max-w-xl shadow-xl">
        <div className="flex items-center p-4">
          <button onClick={onClose} className="p-1 rounded-full hover:bg-[var(--hover)]">
            <X size={20} />
          </button>
        </div>
        <PostComposer
          replyToId={replyToId}
          quoteOfId={quoteOfId}
          onSuccess={onClose}
          autoFocus
        />
      </div>
    </div>
  );
}
