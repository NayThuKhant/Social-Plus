"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Avatar } from "@/components/shared/Avatar";
import { useDmNotificationStore, type DmNotification } from "@/store/dmNotificationStore";

const AUTO_DISMISS_MS = 8000;

function subtext(n: DmNotification): string {
  if (n.isSystem) return `${n.senderName} ${n.content ?? ""}`.trim();
  if (n.type === "reaction") return n.emoji ? `reacted ${n.emoji} to a message` : "reacted to a message";
  if (n.type === "reply") return "replied to a message";
  if (n.type === "request") return "sent you a message request";
  return n.content ?? "📎 Sent a media message";
}

function GroupAvatar({ name, avatarUrl }: { name: string | null | undefined; avatarUrl: string | null | undefined }) {
  if (avatarUrl) {
    return <img src={avatarUrl} alt={name ?? "Group"} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />;
  }
  return (
    <div className="w-9 h-9 rounded-full bg-[var(--accent)] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
      {(name || "G").charAt(0).toUpperCase()}
    </div>
  );
}

function DmCard({ notification: n }: { notification: DmNotification }) {
  const router = useRouter();
  const dismiss = useDmNotificationStore((s) => s.dismiss);

  useEffect(() => {
    const t = setTimeout(() => dismiss(n.id), AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [n.id, dismiss]);

  function open() {
    dismiss(n.id);
    router.push(`/messages/${n.conversationId}`);
  }

  return (
    <div
      className="flex items-start gap-3 bg-[var(--background)] border border-[var(--border)] rounded-2xl shadow-2xl px-4 py-3 w-80 cursor-pointer hover:bg-[var(--hover)] transition-colors animate-in slide-in-from-bottom-4 fade-in duration-200"
      onClick={open}
    >
      {n.isGroup ? (
        <GroupAvatar name={n.groupName} avatarUrl={n.groupAvatar} />
      ) : (
        <Avatar src={n.senderAvatar} alt={n.senderName} size="sm" />
      )}
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm truncate">{n.isGroup ? (n.groupName ?? "Group") : n.senderName}</p>
        <p className="text-[var(--muted)] text-sm truncate">{subtext(n)}</p>
      </div>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); dismiss(n.id); }}
        className="text-[var(--muted)] hover:text-[var(--foreground)] flex-shrink-0 p-0.5 rounded-full hover:bg-[var(--hover)]"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function DmNotificationPopup() {
  const notifications = useDmNotificationStore((s) => s.notifications);
  if (!notifications.length) return null;

  return (
    <div className="fixed bottom-20 right-4 md:bottom-6 z-50 flex flex-col gap-2 items-end">
      {notifications.map((n) => (
        <DmCard key={n.id} notification={n} />
      ))}
    </div>
  );
}
