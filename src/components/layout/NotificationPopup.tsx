"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { X, Heart, Repeat2, UserPlus, MessageCircle, AtSign, Quote } from "lucide-react";
import { Avatar } from "@/components/shared/Avatar";
import { useNotificationPopupStore, type NotifPopup } from "@/store/notificationPopupStore";

const AUTO_DISMISS_MS = 6000;

const typeConfig: Record<string, { label: string; Icon: React.ElementType; color: string }> = {
  LIKE:    { label: "liked your post",     Icon: Heart,          color: "text-rose-500" },
  REPOST:  { label: "reposted your post",  Icon: Repeat2,        color: "text-green-500" },
  FOLLOW:  { label: "followed you",        Icon: UserPlus,       color: "text-[var(--accent)]" },
  REPLY:   { label: "replied to your post",Icon: MessageCircle,  color: "text-[var(--accent)]" },
  MENTION: { label: "mentioned you",       Icon: AtSign,         color: "text-[var(--accent)]" },
  QUOTE:   { label: "quoted your post",    Icon: Quote,          color: "text-purple-500" },
};

function NotifCard({ popup }: { popup: NotifPopup }) {
  const router = useRouter();
  const dismiss = useNotificationPopupStore((s) => s.dismiss);
  const cfg = typeConfig[popup.type] ?? typeConfig.LIKE;
  const { Icon, color, label } = cfg;

  useEffect(() => {
    const t = setTimeout(() => dismiss(popup.id), AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [popup.id, dismiss]);

  function open() {
    dismiss(popup.id);
    if (popup.postId) router.push(`/post/${popup.postId}`);
    else router.push("/notifications");
  }

  return (
    <div
      className="flex items-start gap-3 bg-[var(--background)] border border-[var(--border)] rounded-2xl shadow-2xl px-4 py-3 w-80 cursor-pointer hover:bg-[var(--hover)] transition-colors animate-in slide-in-from-bottom-4 fade-in duration-200"
      onClick={open}
    >
      <div className="relative flex-shrink-0">
        <Avatar src={popup.actorAvatar} alt={popup.actorName} size="sm" />
        <span className={`absolute -bottom-1 -right-1 flex items-center justify-center w-4 h-4 rounded-full bg-[var(--background)] ring-1 ring-[var(--border)] ${color}`}>
          <Icon size={9} />
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm leading-snug">
          <span className="font-bold">{popup.actorName}</span>
          <span className="text-[var(--muted)]"> {label}</span>
        </p>
      </div>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); dismiss(popup.id); }}
        className="text-[var(--muted)] hover:text-[var(--foreground)] flex-shrink-0 p-0.5 rounded-full hover:bg-[var(--hover)]"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function NotificationPopup() {
  const popups = useNotificationPopupStore((s) => s.popups);
  if (!popups.length) return null;

  return (
    <div className="fixed bottom-20 right-4 md:bottom-6 z-50 flex flex-col gap-2 items-end">
      {popups.map((p) => (
        <NotifCard key={p.id} popup={p} />
      ))}
    </div>
  );
}
