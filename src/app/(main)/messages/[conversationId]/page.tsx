"use client";

import { useParams, useRouter } from "next/navigation";
import { useInfiniteQuery, useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import {
  ArrowLeft, Send, Image as ImageIcon, X, Smile, Phone, Video,
  Bookmark, Reply, Forward, SmilePlus, MoreHorizontal, ChevronRight, Plus, Info, Trash2, EyeOff, AlertTriangle,
} from "lucide-react";
import { Avatar } from "@/components/shared/Avatar";
import { VerifiedBadge } from "@/components/shared/VerifiedBadge";
import { GifPicker } from "@/components/post/GifPicker";
import { useTheme } from "@/lib/theme";
import { useAuthStore } from "@/store/authStore";
import { formatRelativeTime } from "@/lib/utils";
import type { MessageWithSender, MessageReaction, ConversationWithMembers, PostWithUser, SafeUser } from "@/types";
import { getSocket, startCallerAutoCancel } from "@/hooks/useGlobalSocket";
import { useDmNotificationStore } from "@/store/dmNotificationStore";
import { useCallStore } from "@/store/callStore";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Theme as EmojiTheme } from "emoji-picker-react";
import { useConfirm } from "@/components/shared/ConfirmDialog";
import { UserPickerSheet } from "@/components/messages/UserPickerSheet";
import { format, isToday, isYesterday, differenceInMinutes } from "date-fns";

const EmojiPicker = dynamic(() => import("emoji-picker-react"), { ssr: false });

const QUICK_REACTIONS = ["❤️", "👍", "😂", "😮", "😢", "🔥"];

function formatMsgGroupTime(date: Date): string {
  if (isToday(date)) return format(date, "h:mm a");
  if (isYesterday(date)) return `Yesterday ${format(date, "h:mm a")}`;
  return format(date, "EEE, MMM d · h:mm a");
}

function extractPostId(text: string): string | null {
  const m = text.trim().match(/^https?:\/\/[^/]+\/post\/([a-z0-9]+)\s*$/i);
  return m ? m[1] : null;
}

const URL_RE = /(https?:\/\/[^\s<>"{}|\\^[\]`]+)/g;

function renderWithLinks(text: string, isOwn: boolean): React.ReactNode {
  const parts = text.split(URL_RE);
  return parts.map((part, i) => {
    if (URL_RE.test(part)) {
      URL_RE.lastIndex = 0;
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={`underline underline-offset-2 break-all ${isOwn ? "text-white/90 hover:text-white" : "text-[var(--accent)] hover:opacity-80"}`}
        >
          {part}
        </a>
      );
    }
    return part;
  });
}

function PostLinkPreview({ postId, isOwn }: { postId: string; isOwn: boolean }) {
  const { data, isLoading } = useQuery<{ data: PostWithUser }>({
    queryKey: ["post", postId],
    queryFn: () => fetch(`/api/posts/${postId}`).then((r) => r.json()),
    staleTime: 60000,
  });
  const post = data?.data;
  if (isLoading) return (
    <div className={`rounded-2xl border border-[var(--border)] p-3 w-56 ${isOwn ? "border-white/20" : ""}`}>
      <div className="h-4 w-3/4 bg-[var(--border)] rounded animate-pulse" />
    </div>
  );
  if (!post) return (
    <div className={`rounded-2xl border w-56 px-4 py-5 flex flex-col items-center gap-2 ${isOwn ? "border-white/20 bg-white/10" : "border-[var(--border)] bg-[var(--hover)]"}`}>
      <EyeOff size={18} className={isOwn ? "text-white/50" : "text-[var(--muted)]"} />
      <p className={`text-xs text-center ${isOwn ? "text-white/60" : "text-[var(--muted)]"}`}>Content not available</p>
    </div>
  );
  return (
    <Link
      href={`/post/${postId}`}
      className={`block rounded-2xl border overflow-hidden w-56 transition-opacity hover:opacity-90 ${isOwn ? "border-white/20 bg-white/10" : "border-[var(--border)] bg-[var(--hover)]"}`}
      onClick={(e) => e.stopPropagation()}
    >
      {post.mediaUrls?.[0] && (
        <img
          src={post.mediaUrls[0]}
          alt=""
          className="w-full h-28 object-cover"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />
      )}
      <div className="p-2.5">
        <div className="flex items-center gap-1.5 mb-0.5">
          <Avatar src={post.user.avatarUrl} alt={post.user.displayName} size="xs" />
          <span className="font-bold text-xs truncate">{post.user.displayName}</span>
          {post.user.verified && <VerifiedBadge size={11} />}
        </div>
        {post.content && <p className="text-xs line-clamp-2 leading-snug">{post.content}</p>}
      </div>
    </Link>
  );
}

function ReactionBubbles({ reactions, messageId, conversationId, currentUserId, isOwn }: {
  reactions: MessageReaction[];
  messageId: string;
  conversationId: string;
  currentUserId: string;
  isOwn: boolean;
}) {
  const queryClient = useQueryClient();

  const grouped = reactions.reduce<Record<string, { count: number; mine: boolean }>>((acc, r) => {
    if (!acc[r.emoji]) acc[r.emoji] = { count: 0, mine: false };
    acc[r.emoji].count++;
    if (r.user.id === currentUserId) acc[r.emoji].mine = true;
    return acc;
  }, {});

  function toggle(emoji: string) {
    fetch(`/api/messages/${conversationId}/messages/${messageId}/react`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    }).then((r) => r.json()).then((d) => {
      if (d.data?.reactions) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        queryClient.setQueryData(["messages", conversationId], (old: any) => {
          if (!old?.pages) return old;
          return {
            ...old,
            pages: old.pages.map((page: { data: { items: MessageWithSender[] } }) => ({
              ...page,
              data: { ...page.data, items: page.data.items.map((m: MessageWithSender) => m.id === messageId ? { ...m, reactions: d.data.reactions } : m) },
            })),
          };
        });
      }
    });
  }

  return (
    <div className={`flex flex-wrap gap-1 relative ${isOwn ? "justify-end" : "justify-start"}`}>
      {Object.entries(grouped).map(([emoji, { count, mine }]) => (
        <button
          key={emoji}
          onClick={() => toggle(emoji)}
          className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs border transition-colors ${
            mine ? "bg-[var(--accent)]/15 border-[var(--accent)] text-[var(--accent)]" : "bg-[var(--background)] border-[var(--border)] hover:border-[var(--accent)]"
          }`}
        >
          <span>{emoji}</span>
          <span className="font-medium">{count}</span>
        </button>
      ))}
    </div>
  );
}

export default function ConversationPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { theme } = useTheme();
  const confirm = useConfirm((s) => s.show);
  const [message, setMessage] = useState("");
  const [mediaPreview, setMediaPreview] = useState<{ url: string; file: File; isVideo: boolean }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showGif, setShowGif] = useState(false);
  const [replyTo, setReplyTo] = useState<MessageWithSender | null>(null);
  const [reactionPickerId, setReactionPickerId] = useState<string | null>(null);
  const [fullReactionPickerId, setFullReactionPickerId] = useState<string | null>(null);
  const [contextMenuId, setContextMenuId] = useState<string | null>(null);
  const [reactionPickerDir, setReactionPickerDir] = useState<"up" | "down">("up");
  const [contextMenuDir, setContextMenuDir] = useState<"up" | "down">("up");
  const [showForwardModal, setShowForwardModal] = useState<MessageWithSender | null>(null);
  const [actionsExpanded, setActionsExpanded] = useState(true);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [scrollTarget, setScrollTarget] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const prevScrollHeightRef = useRef(0);
  const emojiRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const { data: convData } = useQuery<{ data: ConversationWithMembers }>({
    queryKey: ["conversation", conversationId],
    queryFn: () => fetch(`/api/messages/${conversationId}`).then((r) => r.json()),
  });
  const conversation = convData?.data;
  const other = conversation?.members.find((m) => m.id !== user?.id) || conversation?.members[0];
  const isSelf = !!other && other.id === user?.id;
  const callStore = useCallStore();

  const { data: blockStatus } = useQuery<{ data: { blocked: boolean; blockedByThem: boolean } }>({
    queryKey: ["blockStatus", other?.username],
    queryFn: () => fetch(`/api/users/${other!.username}/block`).then((r) => r.json()),
    enabled: !!other && !isSelf && !conversation?.isGroup,
  });
  const isBlockRelationship = !isSelf && !conversation?.isGroup && (blockStatus?.data?.blocked || blockStatus?.data?.blockedByThem);

  const { data: myBlockedData } = useQuery<{ data: Array<{ id: string }> }>({
    queryKey: ["my-blocked"],
    queryFn: () => fetch("/api/users/blocked").then((r) => r.json()),
    enabled: !!conversation?.isGroup,
    staleTime: 60000,
  });
  const blockedIds = new Set((myBlockedData?.data ?? []).map((u) => u.id));
  const blockedGroupMembers = conversation?.isGroup
    ? (conversation.members.filter((m) => m.id !== user?.id && blockedIds.has(m.id)))
    : [];

  const isReceivedRequest = !!conversation?.isRequest && conversation.requesterId !== user?.id;
  const isSentRequest = !!conversation?.isRequest && conversation.requesterId === user?.id;
  const [requestAction, setRequestAction] = useState<"accept" | "decline" | null>(null);

  async function handleAccept() {
    setRequestAction("accept");
    try {
      const res = await fetch(`/api/messages/${conversationId}/accept`, { method: "POST" });
      if (!res.ok) throw new Error();
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["conversation", conversationId] });
    } catch {
      import("sonner").then(({ toast }) => toast.error("Failed to accept"));
    } finally {
      setRequestAction(null);
    }
  }

  async function handleDecline() {
    setRequestAction("decline");
    try {
      const res = await fetch(`/api/messages/${conversationId}/decline`, { method: "POST" });
      if (!res.ok) throw new Error();
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      router.replace("/messages");
    } catch {
      import("sonner").then(({ toast }) => toast.error("Failed to decline"));
      setRequestAction(null);
    }
  }

  function initiateCall(isVideo: boolean) {
    if (!user || !conversation) return;
    if (conversation.isGroup) {
      const roomName = `call-group-${conversationId}`;
      const otherMembers = conversation.members.filter((m) => m.id !== user.id);
      const firstOther = otherMembers[0];
      callStore.startOutgoing({
        peerId: firstOther?.id ?? "",
        peerName: conversation.name ?? "Group",
        peerAvatar: (conversation as { avatarUrl?: string | null }).avatarUrl ?? null,
        isVideo,
        conversationId: conversationId as string,
        roomName,
        isGroup: true,
        memberIds: otherMembers.map((m) => m.id),
      });
      getSocket().emit("call:group-invite", {
        targetUserIds: otherMembers.map((m) => m.id),
        callerId: user.id,
        callerName: user.displayName,
        callerAvatar: user.avatarUrl ?? null,
        groupName: conversation.name,
        groupAvatar: (conversation as { avatarUrl?: string | null }).avatarUrl ?? null,
        roomName,
        isVideo,
        conversationId,
      });
    } else {
      if (!other) return;
      const roomName = `call-${[user.id, other.id].sort().join("-")}`;
      callStore.startOutgoing({ peerId: other.id, peerName: other.displayName, peerAvatar: other.avatarUrl ?? null, isVideo, conversationId: conversationId as string, roomName });
      getSocket().emit("call:invite", { targetUserId: other.id, callerId: user.id, callerName: user.displayName, callerAvatar: user.avatarUrl ?? null, roomName, isVideo, conversationId });
      startCallerAutoCancel(other.id);
    }
  }

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery<{ data: { items: MessageWithSender[]; nextCursor: string | null } }>({
      queryKey: ["messages", conversationId],
      queryFn: ({ pageParam }) => {
        const url = new URL(`/api/messages/${conversationId}/messages`, window.location.origin);
        if (pageParam) url.searchParams.set("cursor", pageParam as string);
        return fetch(url.toString()).then((r) => r.json());
      },
      initialPageParam: null,
      getNextPageParam: (last) => last.data?.nextCursor ?? undefined,
    });

  const [liveMessages, setLiveMessages] = useState<MessageWithSender[]>([]);
  const historicMessages = [...(data?.pages || [])].reverse().flatMap((p) => p.data?.items || []);
  const messages = [
    ...historicMessages,
    ...liveMessages.filter((m) => !historicMessages.some((h) => h.id === m.id)),
  ];

  // Enrich messages with grouping metadata — no memo so reaction/deletion updates always reflect
  const enriched = messages.map((msg, i) => {
    const prev = messages[i - 1];
    const next = messages[i + 1];
    const d = new Date(msg.createdAt);
    const pd = prev ? new Date(prev.createdAt) : null;
    const nd = next ? new Date(next.createdAt) : null;
    const gapFromPrev = pd ? differenceInMinutes(d, pd) : Infinity;
    const gapToNext = nd ? differenceInMinutes(nd, d) : Infinity;
    const sameSenderAsPrev = !!prev && prev.sender.id === msg.sender.id && !msg.isSystem && !prev.isSystem;
    const sameSenderAsNext = !!next && next.sender.id === msg.sender.id && !msg.isSystem && !next.isSystem;
    return {
      ...msg,
      showTimeHeader: gapFromPrev > 10,
      isChainedFromPrev: sameSenderAsPrev && gapFromPrev <= 3,
      isChainedToNext: sameSenderAsNext && gapToNext <= 3,
    };
  });

  // Mark conversation as read
  useEffect(() => {
    type ConvCache = { data: Array<{ id: string; unreadCount: number }> };
    queryClient.setQueryData(["conversations"], (old: ConvCache | undefined) => {
      if (!old?.data) return old;
      return { ...old, data: old.data.map((c) => c.id === conversationId ? { ...c, unreadCount: 0 } : c) };
    });
    const updated = queryClient.getQueryData<ConvCache>(["conversations"]);
    if (updated?.data) {
      const remaining = updated.data.reduce((s, c) => s + (c.unreadCount ?? 0), 0);
      useDmNotificationStore.getState().setUnreadCount(remaining);
    } else {
      fetch("/api/messages/unread").then((r) => r.json()).then((d) => useDmNotificationStore.getState().setUnreadCount(d?.data?.count ?? 0)).catch(() => {});
    }
  }, [conversationId, queryClient]);

  // Scroll to bottom on new live messages
  useEffect(() => {
    if (liveMessages.length > 0) {
      const c = scrollContainerRef.current;
      if (c) c.scrollTop = c.scrollHeight;
    }
  }, [liveMessages.length]);

  // Jump to bottom on first load
  useLayoutEffect(() => {
    if (data?.pages.length === 1) {
      const c = scrollContainerRef.current;
      if (c) c.scrollTop = c.scrollHeight;
    }
  }, [data?.pages.length]);

  // Re-scroll after images settle
  useEffect(() => {
    if (data?.pages.length !== 1) return;
    const t = setTimeout(() => {
      const c = scrollContainerRef.current;
      if (c) c.scrollTop = c.scrollHeight;
    }, 400);
    return () => clearTimeout(t);
  }, [data?.pages.length]);

  // Restore scroll after prepending older messages
  useEffect(() => {
    if (!isFetchingNextPage && prevScrollHeightRef.current > 0) {
      const c = scrollContainerRef.current;
      if (c) c.scrollTop = c.scrollHeight - prevScrollHeightRef.current;
      prevScrollHeightRef.current = 0;
    }
  }, [isFetchingNextPage]);

  // After each page load, try scrolling to a pending target
  useEffect(() => {
    if (!scrollTarget) return;
    const el = messageRefs.current.get(scrollTarget);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedId(scrollTarget);
      setTimeout(() => setHighlightedId(null), 2000);
      setScrollTarget(null);
    } else if (hasNextPage && !isFetchingNextPage) {
      if (scrollContainerRef.current) prevScrollHeightRef.current = scrollContainerRef.current.scrollHeight;
      fetchNextPage();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.pages.length, scrollTarget]);

  const loadOlder = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      if (scrollContainerRef.current) prevScrollHeightRef.current = scrollContainerRef.current.scrollHeight;
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  useEffect(() => {
    const sentinel = topSentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) loadOlder(); }, { threshold: 0 });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadOlder]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      const path = e.composedPath();
      const inEmoji = emojiRef.current && path.includes(emojiRef.current);
      if (!inEmoji) setShowEmoji(false);
      const t = e.target as HTMLElement;
      if (!t.closest("[data-msg-action]") && !path.some((n) => (n as HTMLElement).dataset?.msgAction !== undefined)) {
        setReactionPickerId(null);
        setFullReactionPickerId(null);
        setContextMenuId(null);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // Socket
  useEffect(() => {
    const sock = getSocket();
    function joinRoom() { sock.emit("join-conversation", conversationId); }
    if (sock.connected) joinRoom();
    sock.on("connect", joinRoom);
    function onNewMessage(msg: MessageWithSender) {
      setLiveMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
    }
    function onReaction({ messageId, reactions }: { messageId: string; reactions: MessageReaction[] }) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      queryClient.setQueryData(["messages", conversationId], (old: any) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page: { data: { items: MessageWithSender[] } }) => ({
            ...page,
            data: { ...page.data, items: page.data.items.map((m: MessageWithSender) => m.id === messageId ? { ...m, reactions } : m) },
          })),
        };
      });
      setLiveMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, reactions } : m));
    }
    function onMessageDeleted({ messageId, deletedByName }: { messageId: string; scope: string; deletedByName?: string }) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const patch = (m: MessageWithSender) => m.id !== messageId ? m : {
        ...m, isDeleted: true, content: null, mediaUrls: [], reactions: [],
        sender: deletedByName ? { ...m.sender, displayName: deletedByName } : m.sender,
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      queryClient.setQueryData(["messages", conversationId], (old: any) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page: { data: { items: MessageWithSender[] } }) => ({
            ...page,
            data: { ...page.data, items: page.data.items.map(patch) },
          })),
        };
      });
      setLiveMessages((prev) => prev.map(patch));
    }
    function onConvAccepted({ conversationId: cid }: { conversationId: string }) {
      if (cid === conversationId) {
        queryClient.invalidateQueries({ queryKey: ["conversation", conversationId] });
      }
    }
    function onConvDeclined({ conversationId: cid }: { conversationId: string }) {
      if (cid === conversationId) router.replace("/messages");
    }
    function onBlockChanged() {
      queryClient.invalidateQueries({ queryKey: ["blockStatus"] });
    }
    function onMemberAdded({ conversationId: cid }: { conversationId: string }) {
      if (cid === conversationId) queryClient.invalidateQueries({ queryKey: ["conversation", conversationId] });
    }
    function onMemberRemoved({ conversationId: cid, userId: uid }: { conversationId: string; userId: string }) {
      if (cid !== conversationId) return;
      if (uid === user?.id) { router.replace("/messages"); return; }
      queryClient.invalidateQueries({ queryKey: ["conversation", conversationId] });
    }
    function onMemberLeft({ conversationId: cid, userId: uid }: { conversationId: string; userId: string }) {
      if (cid !== conversationId) return;
      if (uid === user?.id) { router.replace("/messages"); return; }
      queryClient.invalidateQueries({ queryKey: ["conversation", conversationId] });
    }
    function onConvCleared({ conversationId: cid }: { conversationId: string }) {
      if (cid !== conversationId) return;
      setLiveMessages([]);
      queryClient.removeQueries({ queryKey: ["messages", conversationId] });
    }
    function onConvUpdated({ conversationId: cid, name, avatarUrl, adminId }: { conversationId: string; name?: string | null; avatarUrl?: string | null; adminId?: string | null }) {
      if (cid !== conversationId) return;
      queryClient.setQueryData(["conversation", conversationId], (old: { data: ConversationWithMembers } | undefined) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: {
            ...old.data,
            ...(name !== undefined ? { name } : {}),
            ...(avatarUrl !== undefined ? { avatarUrl } : {}),
            ...(adminId !== undefined ? { requesterId: adminId } : {}),
          },
        };
      });
    }
    sock.on("new-message", onNewMessage);
    sock.on("message-reaction", onReaction);
    sock.on("message-deleted", onMessageDeleted);
    sock.on("conv-accepted", onConvAccepted);
    sock.on("conv-declined", onConvDeclined);
    sock.on("block-changed", onBlockChanged);
    sock.on("member-added", onMemberAdded);
    sock.on("member-removed", onMemberRemoved);
    sock.on("member-left", onMemberLeft);
    sock.on("conv-updated", onConvUpdated);
    sock.on("conv-cleared", onConvCleared);
    return () => {
      sock.emit("leave-conversation", conversationId);
      sock.off("connect", joinRoom);
      sock.off("new-message", onNewMessage);
      sock.off("message-reaction", onReaction);
      sock.off("message-deleted", onMessageDeleted);
      sock.off("conv-accepted", onConvAccepted);
      sock.off("conv-declined", onConvDeclined);
      sock.off("block-changed", onBlockChanged);
      sock.off("member-added", onMemberAdded);
      sock.off("member-removed", onMemberRemoved);
      sock.off("member-left", onMemberLeft);
      sock.off("conv-updated", onConvUpdated);
      sock.off("conv-cleared", onConvCleared);
    };
  }, [conversationId, queryClient]);

  async function uploadFile(file: File): Promise<string> {
    const form = new FormData();
    form.append("file", file);
    form.append("context", "media");
    const res = await fetch("/api/upload", { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data.data.url as string;
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []).slice(0, 4 - mediaPreview.length);
    for (const file of files) {
      setMediaPreview((prev) => [...prev, { url: URL.createObjectURL(file), file, isVideo: file.type.startsWith("video") }]);
    }
    e.target.value = "";
  }

  async function deleteMessage(messageId: string, scope: "me" | "all") {
    setContextMenuId(null);
    const ok = await confirm({
      title: scope === "all" ? "Delete for everyone?" : "Delete for me?",
      message: scope === "all" ? "Everyone will see a deleted placeholder." : "This message will only be removed for you.",
      confirmLabel: scope === "all" ? "Delete for everyone" : "Delete for me",
      danger: true,
    });
    if (!ok) return;
    fetch(`/api/messages/${conversationId}/messages/${messageId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope }),
    }).then((r) => r.json()).then((d) => {
      if (d.data?.ok) {
        if (scope === "all") {
          // Mark as deleted — show placeholder for everyone
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          queryClient.setQueryData(["messages", conversationId], (old: any) => {
            if (!old?.pages) return old;
            return {
              ...old,
              pages: old.pages.map((page: { data: { items: MessageWithSender[] } }) => ({
                ...page,
                data: { ...page.data, items: page.data.items.map((m: MessageWithSender) => m.id === messageId ? { ...m, isDeleted: true, content: null, mediaUrls: [], reactions: [] } : m) },
              })),
            };
          });
          setLiveMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, isDeleted: true, content: null, mediaUrls: [], reactions: [] } : m));
        } else {
          // "delete for me" — remove entirely from local view
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          queryClient.setQueryData(["messages", conversationId], (old: any) => {
            if (!old?.pages) return old;
            return {
              ...old,
              pages: old.pages.map((page: { data: { items: MessageWithSender[] } }) => ({
                ...page,
                data: { ...page.data, items: page.data.items.filter((m: MessageWithSender) => m.id !== messageId) },
              })),
            };
          });
          setLiveMessages((prev) => prev.filter((m) => m.id !== messageId));
        }
      }
    });
  }

  const { mutate: sendMessage, isPending } = useMutation({
    mutationFn: async ({ content, mediaUrls, replyToId }: { content?: string; mediaUrls?: string[]; replyToId?: string }) =>
      fetch(`/api/messages/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, mediaUrls, replyToId }),
      }).then((r) => r.json()),
    onSuccess: (resp) => {
      if (resp.data) {
        setLiveMessages((prev) => prev.some((m) => m.id === resp.data.id) ? prev : [...prev, resp.data]);
        queryClient.setQueryData(
          ["conversations"],
          (old: { data: Array<{ id: string; lastMessage: unknown; updatedAt: string }> } | undefined) => {
            if (!old?.data) return old;
            return {
              ...old,
              data: old.data
                .map((c) => c.id === conversationId ? { ...c, lastMessage: resp.data, updatedAt: resp.data.createdAt } : c)
                .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
            };
          }
        );
      }
      setMessage("");
      setMediaPreview([]);
      setReplyTo(null);
      // Reset textarea height
      if (inputRef.current) { inputRef.current.style.height = "auto"; }
    },
  });

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if ((!message.trim() && mediaPreview.length === 0) || isPending || uploading) return;
    setUploading(true);
    try {
      const mediaUrls = await Promise.all(mediaPreview.map((m) => uploadFile(m.file)));
      sendMessage({ content: message.trim() || undefined, mediaUrls: mediaUrls.length ? mediaUrls : undefined, replyToId: replyTo?.id });
    } catch { /* silent */ } finally {
      setUploading(false);
    }
  }

  function handleGifSelect(original: string) {
    sendMessage({ mediaUrls: [original], replyToId: replyTo?.id });
    setReplyTo(null);
    setShowGif(false);
  }

  function handleReact(messageId: string, emoji: string) {
    fetch(`/api/messages/${conversationId}/messages/${messageId}/react`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    }).then((r) => r.json()).then((d) => {
      if (d.data?.reactions) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        queryClient.setQueryData(["messages", conversationId], (old: any) => {
          if (!old?.pages) return old;
          return {
            ...old,
            pages: old.pages.map((page: { data: { items: MessageWithSender[] } }) => ({
              ...page,
              data: { ...page.data, items: page.data.items.map((m: MessageWithSender) => m.id === messageId ? { ...m, reactions: d.data.reactions } : m) },
            })),
          };
        });
        setLiveMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, reactions: d.data.reactions } : m));
      }
    });
  }

  function scrollToMessage(messageId: string) {
    const el = messageRefs.current.get(messageId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedId(messageId);
      setTimeout(() => setHighlightedId(null), 2000);
    } else {
      setScrollTarget(messageId);
    }
  }

  function adjustTextarea(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }

  function calcPopupDir(e: React.MouseEvent): "up" | "down" {
    const container = scrollContainerRef.current;
    if (!container) return "up";
    const btnRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    // If less than 200px of space above the button inside the scroll area → render down
    return (btnRect.top - containerRect.top) < 200 ? "down" : "up";
  }

  return (
    <div className="fixed inset-0 z-10 flex flex-col bg-[var(--background)] lg:static lg:h-screen">
      {/* Header */}
      <div className="flex-shrink-0 bg-[var(--background)]/90 backdrop-blur-md border-b border-[var(--border)] px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 rounded-full hover:bg-[var(--hover)]">
          <ArrowLeft size={20} />
        </button>
        {other && (
          isSelf ? (
            <>
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-8 h-8 rounded-full bg-[var(--accent)]/15 flex items-center justify-center flex-shrink-0">
                  <Bookmark size={16} className="text-[var(--accent)]" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold">Saved Messages</p>
                  <p className="text-[var(--muted)] text-xs">Only visible to you</p>
                </div>
              </div>
              <Link href={`/messages/${conversationId}/info`} className="p-2 rounded-full hover:bg-[var(--hover)] flex-shrink-0" aria-label="Conversation info"><Info size={20} /></Link>
            </>
          ) : conversation?.isGroup ? (
            <>
              <Link href={`/messages/${conversationId}/info`} className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-90 transition-opacity">
                {(conversation as { avatarUrl?: string | null }).avatarUrl ? (
                  <img src={(conversation as { avatarUrl: string }).avatarUrl} alt={conversation.name || "Group"} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[var(--accent)] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {(conversation.name || "G").charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-bold truncate">{conversation.name}</p>
                  <p className="text-[var(--muted)] text-xs">{conversation.members.length} members</p>
                </div>
              </Link>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => initiateCall(false)} className="p-2 rounded-full hover:bg-[var(--hover)]" aria-label="Voice call"><Phone size={20} /></button>
                <button onClick={() => initiateCall(true)} className="p-2 rounded-full hover:bg-[var(--hover)]" aria-label="Video call"><Video size={20} /></button>
                <Link href={`/messages/${conversationId}/info`} className="p-2 rounded-full hover:bg-[var(--hover)]" aria-label="Group info"><Info size={20} /></Link>
              </div>
            </>
          ) : (
            <>
              <Link href={`/${other.username}`} className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-90 transition-opacity">
                <Avatar src={other.avatarUrl} alt={other.displayName} size="sm" />
                <div className="min-w-0">
                  <p className="font-bold truncate">{other.displayName}</p>
                  <p className="text-[var(--muted)] text-xs truncate">@{other.username}</p>
                </div>
              </Link>
              <div className="flex items-center gap-1 flex-shrink-0">
                {!conversation?.isRequest && <>
                  <button onClick={() => initiateCall(false)} className="p-2 rounded-full hover:bg-[var(--hover)]" aria-label="Voice call"><Phone size={20} /></button>
                  <button onClick={() => initiateCall(true)} className="p-2 rounded-full hover:bg-[var(--hover)]" aria-label="Video call"><Video size={20} /></button>
                </>}
                <Link href={`/messages/${conversationId}/info`} className="p-2 rounded-full hover:bg-[var(--hover)]" aria-label="Conversation info"><Info size={20} /></Link>
              </div>
            </>
          )
        )}
      </div>

      {/* Blocked member warning banner */}
      {blockedGroupMembers.length > 0 && (
        <div className="flex-shrink-0 bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center gap-2">
          <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Someone you blocked is in this group — you&apos;ll still see their messages and interact with them in this group.
          </p>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto px-3 py-4">
        <div ref={topSentinelRef} className="h-1" />
        {isFetchingNextPage && (
          <div className="flex justify-center py-2">
            <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {enriched.map((msg) => {
          const isOwn = msg.sender.id === user?.id;
          const hasMedia = msg.mediaUrls && msg.mediaUrls.length > 0;
          const postId = msg.content ? extractPostId(msg.content) : null;
          const replyTargetVisible = !msg.replyTo || messages.some((m) => m.id === msg.replyTo!.id);
          const hasReactions = msg.reactions && msg.reactions.length > 0;
          const isReactionOpen = reactionPickerId === msg.id;
          const isFullReactionOpen = fullReactionPickerId === msg.id;
          const isMenuOpen = contextMenuId === msg.id;
          const isHighlighted = highlightedId === msg.id;

          return (
            <div
              key={msg.id}
              ref={(el) => { if (el) messageRefs.current.set(msg.id, el); else messageRefs.current.delete(msg.id); }}
              className={`group transition-colors duration-300 rounded-xl ${isHighlighted ? "bg-[var(--accent)]/10" : ""} ${msg.isChainedFromPrev ? "mt-0.5" : "mt-1.5"}`}
            >
              {/* Time header */}
              {msg.showTimeHeader && (
                <div className="flex items-center justify-center py-2 mb-1">
                  <span className="text-xs text-[var(--muted)] bg-[var(--hover)] px-3 py-1 rounded-full">
                    {formatMsgGroupTime(new Date(msg.createdAt))}
                  </span>
                </div>
              )}

              {/* System activity message */}
              {msg.isSystem ? (
                <div className="flex justify-center py-1 px-4">
                  <span className="text-xs text-[var(--muted)] bg-[var(--hover)] px-3 py-1 rounded-full text-center">
                    <span className="font-semibold">{msg.sender.displayName}</span> {msg.content}
                  </span>
                </div>
              ) : msg.isDeleted ? (
                <div className={`flex items-center gap-1.5 ${isOwn ? "flex-row-reverse" : ""}`}>
                  <div className="w-6 flex-shrink-0">
                    {!isOwn && !msg.isChainedToNext && (
                      <button onClick={() => router.push(`/${msg.sender.username}`)} className="block rounded-full hover:opacity-80 transition-opacity">
                        <Avatar src={msg.sender.avatarUrl} alt={msg.sender.displayName} size="xs" />
                      </button>
                    )}
                  </div>
                  <div className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl border border-dashed border-[var(--border)] text-[var(--muted)] text-xs italic`}>
                    <span>{isOwn ? "You deleted a message" : `${msg.sender.displayName} deleted a message`}</span>
                  </div>
                </div>
              ) : (<>

              {/* Reply context — clickable to jump to original */}
              {msg.replyTo && (
                <div className={`flex ${isOwn ? "justify-end" : "justify-start"} mb-0.5`}>
                  <button
                    onClick={() => replyTargetVisible && scrollToMessage(msg.replyTo!.id)}
                    disabled={!replyTargetVisible}
                    className={`flex items-center gap-1.5 max-w-[220px] px-2.5 py-1 rounded-lg text-xs ${isOwn ? "mr-2" : "ml-7"} bg-[var(--hover)] border-l-2 border-[var(--accent)] opacity-75 hover:opacity-100 transition-opacity text-left disabled:cursor-default`}
                  >
                    <Reply size={10} className="text-[var(--accent)] flex-shrink-0" />
                    <span className="font-semibold text-[var(--accent)] truncate">{msg.replyTo.sender.displayName}</span>
                    <span className="text-[var(--muted)] truncate italic">
                      {replyTargetVisible
                        ? (msg.replyTo.content ? msg.replyTo.content.slice(0, 30) + (msg.replyTo.content.length > 30 ? "…" : "") : "📎")
                        : "Message deleted"}
                    </span>
                  </button>
                </div>
              )}

              <div className={`flex items-end gap-1.5 ${isOwn ? "flex-row-reverse" : ""}`}>
                {/* Avatar — only on last in chain, clickable to profile */}
                <div className="w-6 flex-shrink-0">
                  {!isOwn && !msg.isChainedToNext && (
                    <button onClick={() => router.push(`/${msg.sender.username}`)} className="block rounded-full hover:opacity-80 transition-opacity">
                      <Avatar src={msg.sender.avatarUrl} alt={msg.sender.displayName} size="xs" />
                    </button>
                  )}
                </div>

                {/* Bubble + actions */}
                <div className={`flex items-end gap-1 ${isOwn ? "flex-row-reverse" : ""}`}>
                  {/* Bubble */}
                  <div className={`relative max-w-[260px] sm:max-w-xs lg:max-w-md min-w-0 flex flex-col gap-0.5 ${isOwn ? "items-end" : "items-start"} ${hasReactions ? "mb-4" : ""}`}>
                    {hasMedia && (
                      <div className={`grid gap-1 overflow-hidden ${msg.mediaUrls!.length > 1 ? "grid-cols-2" : ""} ${isOwn ? "rounded-2xl rounded-br-sm" : "rounded-2xl rounded-bl-sm"}`}>
                        {msg.mediaUrls!.map((url, i) => {
                          const isVideo = /\.(mp4|mov|webm|ogg)(\?|$)/i.test(url);
                          return isVideo
                            ? <video key={i} src={url} controls className="w-full h-48 object-cover" />
                            : <img key={i} src={url} alt="" className="max-w-[240px]" />;
                        })}
                      </div>
                    )}
                    {postId
                      ? <PostLinkPreview postId={postId} isOwn={isOwn} />
                      : msg.content
                        ? (
                          <div className={`px-3.5 py-2 text-sm break-words ${
                            isOwn
                              ? `bg-[var(--accent)] text-white ${msg.isChainedFromPrev && msg.isChainedToNext ? "rounded-2xl rounded-tr-sm rounded-br-sm" : "rounded-2xl rounded-br-sm"}`
                              : `bg-[var(--hover)] ${msg.isChainedFromPrev && msg.isChainedToNext ? "rounded-2xl rounded-tl-sm rounded-bl-sm" : "rounded-2xl rounded-bl-sm"}`
                          }`}>
                            {renderWithLinks(msg.content, isOwn)}
                          </div>
                        )
                        : null
                    }

                    {/* Reaction bubbles — overlapping the bubble bottom (Messenger style) */}
                    {hasReactions && (
                      <div className={`absolute bottom-0 translate-y-1/2 z-10 ${isOwn ? "right-2" : "left-2"}`}>
                        <ReactionBubbles
                          reactions={msg.reactions!}
                          messageId={msg.id}
                          conversationId={conversationId as string}
                          currentUserId={user?.id ?? ""}
                          isOwn={isOwn}
                        />
                      </div>
                    )}
                  </div>

                  {/* Floating action bar */}
                  <div data-msg-action className={`flex flex-row gap-1 opacity-0 group-hover:opacity-100 transition-opacity self-center ${isOwn ? "flex-row-reverse" : ""}`}>
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          const dir = calcPopupDir(e);
                          setReactionPickerDir(dir);
                          setReactionPickerId(isReactionOpen ? null : msg.id);
                          setContextMenuId(null);
                        }}
                        className="w-7 h-7 flex items-center justify-center rounded-full bg-[var(--background)] border border-[var(--border)] shadow-sm hover:bg-[var(--hover)] text-[var(--muted)] transition-colors"
                      >
                        <SmilePlus size={14} />
                      </button>
                      {isReactionOpen && (
                        <div data-msg-action className={`absolute ${reactionPickerDir === "up" ? "bottom-full mb-2" : "top-full mt-2"} bg-[var(--background)] border border-[var(--border)] rounded-2xl shadow-xl px-3 py-2.5 flex items-center gap-2 z-30 whitespace-nowrap ${isOwn ? "right-0" : "left-0"}`}>
                          {QUICK_REACTIONS.map((emoji) => (
                            <button key={emoji} onClick={() => { handleReact(msg.id, emoji); setReactionPickerId(null); }} className="text-2xl hover:scale-125 transition-transform leading-none">
                              {emoji}
                            </button>
                          ))}
                          <button
                            onClick={() => { setFullReactionPickerId(isFullReactionOpen ? null : msg.id); }}
                            className="flex items-center justify-center w-7 h-7 rounded-full border border-[var(--border)] bg-[var(--background)] hover:border-[var(--accent)] text-[var(--muted)] hover:text-[var(--accent)] transition-colors text-base font-bold leading-none"
                          >
                            <Plus size={13} />
                          </button>
                          {isFullReactionOpen && (
                            <div data-msg-action className={`absolute ${reactionPickerDir === "up" ? "bottom-full mb-1" : "top-full mt-1"} z-40 ${isOwn ? "right-0" : "left-0"}`}>
                              <EmojiPicker
                                theme={theme === "dark" ? EmojiTheme.DARK : EmojiTheme.LIGHT}
                                onEmojiClick={(d) => { handleReact(msg.id, d.emoji); setReactionPickerId(null); setFullReactionPickerId(null); }}
                                skinTonesDisabled height={320} width={280}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          const dir = calcPopupDir(e);
                          setContextMenuDir(dir);
                          setContextMenuId(isMenuOpen ? null : msg.id);
                          setReactionPickerId(null);
                        }}
                        className="w-7 h-7 flex items-center justify-center rounded-full bg-[var(--background)] border border-[var(--border)] shadow-sm hover:bg-[var(--hover)] text-[var(--muted)] transition-colors"
                      >
                        <MoreHorizontal size={14} />
                      </button>
                      {isMenuOpen && (
                        <div className={`absolute ${contextMenuDir === "up" ? "bottom-full mb-2" : "top-full mt-2"} bg-[var(--background)] border border-[var(--border)] rounded-2xl shadow-xl overflow-hidden min-w-[160px] z-30 ${isOwn ? "right-0" : "left-0"}`}>
                          <button
                            onClick={() => { setReplyTo(msg); setContextMenuId(null); inputRef.current?.focus(); }}
                            className="flex items-center gap-3 w-full px-4 py-3 hover:bg-[var(--hover)] text-sm border-b border-[var(--border)]"
                          >
                            <Reply size={15} /> Reply
                          </button>
                          <button
                            onClick={() => { setShowForwardModal(msg); setContextMenuId(null); }}
                            className="flex items-center gap-3 w-full px-4 py-3 hover:bg-[var(--hover)] text-sm border-b border-[var(--border)]"
                          >
                            <Forward size={15} /> Forward
                          </button>
                          <button
                            onClick={() => deleteMessage(msg.id, "me")}
                            className="flex items-center gap-3 w-full px-4 py-3 hover:bg-[var(--hover)] text-sm border-b border-[var(--border)] text-[var(--muted)]"
                          >
                            <Trash2 size={15} /> Delete for me
                          </button>
                          {msg.sender.id === user?.id && (
                            <button
                              onClick={() => deleteMessage(msg.id, "all")}
                              className="flex items-center gap-3 w-full px-4 py-3 hover:bg-[var(--hover)] text-sm text-red-500"
                            >
                              <Trash2 size={15} /> Delete for all
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>)}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Reply preview strip */}
      {replyTo && !isBlockRelationship && !isReceivedRequest && (
        <div className="flex-shrink-0 border-t border-[var(--border)] px-4 py-2 flex items-center gap-2.5 bg-[var(--hover)]">
          <Reply size={15} className="text-[var(--accent)] flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-[var(--accent)]">{replyTo.sender.displayName}</p>
            <p className="text-xs text-[var(--muted)] truncate">{replyTo.content || "📎 Media"}</p>
          </div>
          <button onClick={() => setReplyTo(null)} className="p-1 rounded-full hover:bg-[var(--border)]"><X size={14} /></button>
        </div>
      )}

      {/* Received request banner — accept or decline */}
      {isReceivedRequest && !isBlockRelationship && (
        <div className="flex-shrink-0 border-t border-[var(--border)] px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+64px+16px)] lg:pb-4 space-y-3">
          <p className="text-sm text-center text-[var(--muted)]">
            <span className="font-semibold text-[var(--foreground)]">{other?.displayName}</span> wants to send you a message.
          </p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={handleAccept}
              disabled={!!requestAction}
              className="px-6 py-2 rounded-full bg-[var(--accent)] text-white text-sm font-bold disabled:opacity-50 transition-opacity"
            >
              {requestAction === "accept" ? "…" : "Accept"}
            </button>
            <button
              onClick={handleDecline}
              disabled={!!requestAction}
              className="px-6 py-2 rounded-full border border-[var(--border)] text-sm font-bold hover:bg-[var(--hover)] disabled:opacity-50 transition-colors"
            >
              {requestAction === "decline" ? "…" : "Decline"}
            </button>
          </div>
        </div>
      )}

      {/* Sent request banner */}
      {isSentRequest && !isBlockRelationship && (
        <div className="flex-shrink-0 border-t border-[var(--border)] px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+64px+16px)] lg:pb-4 text-center text-sm text-[var(--muted)]">
          Your message request is waiting for a reply.
        </div>
      )}

      {/* Blocked banner — replaces composer */}
      {isBlockRelationship && (
        <div className="flex-shrink-0 border-t border-[var(--border)] px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+64px+16px)] lg:pb-4 text-center text-sm text-[var(--muted)]">
          {blockStatus?.data?.blocked
            ? "You've blocked this person. Unblock them to send messages."
            : "You can't reply to this conversation."}
        </div>
      )}

      {/* Composer */}
      {!isBlockRelationship && !isReceivedRequest && <form onSubmit={handleSend} className="flex-shrink-0 border-t border-[var(--border)] px-3 pt-2 pb-[calc(env(safe-area-inset-bottom)+64px)] lg:pb-3">
        {/* Media previews */}
        {mediaPreview.length > 0 && (
          <div className="flex gap-2 flex-wrap mb-2">
            {mediaPreview.map((m, i) => (
              <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden bg-[var(--border)]">
                {m.isVideo
                  ? <video src={m.url} className="w-full h-full object-cover" muted playsInline />
                  : <img src={m.url} alt="" className="w-full h-full object-cover" />
                }
                <button type="button" onClick={() => setMediaPreview((prev) => prev.filter((_, j) => j !== i))} className="absolute top-0.5 right-0.5 bg-black/70 rounded-full p-0.5 text-white">
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-1.5">
          {/* Collapse/expand toggle on mobile when input focused */}
          {!actionsExpanded ? (
            <button
              type="button"
              onClick={() => { setActionsExpanded(true); inputRef.current?.blur(); }}
              className="p-2 text-[var(--accent)] flex-shrink-0"
            >
              <ChevronRight size={22} />
            </button>
          ) : (
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <input ref={fileRef} type="file" multiple accept="image/*,video/*" onChange={handleFileChange} className="hidden" />
              <button type="button" onClick={() => fileRef.current?.click()} disabled={mediaPreview.length >= 4} className="p-2 text-[var(--muted)] hover:text-[var(--accent)] disabled:opacity-40 transition-colors">
                <ImageIcon size={21} />
              </button>

              <div className="relative" ref={emojiRef}>
                <button type="button" onClick={() => { setShowGif(false); setShowEmoji((v) => !v); }} className="p-2 text-[var(--muted)] hover:text-[var(--accent)] transition-colors">
                  <Smile size={21} />
                </button>
                {showEmoji && (
                  <>
                    <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onMouseDown={() => setShowEmoji(false)} />
                    <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+64px)] z-50 lg:absolute lg:inset-x-auto lg:bottom-full lg:mb-2 lg:left-0">
                      <div className="flex justify-center pt-2.5 pb-1 bg-[var(--background)] rounded-t-2xl lg:hidden">
                        <div className="w-10 h-1 rounded-full bg-[var(--muted)]/30" />
                      </div>
                      <EmojiPicker
                        theme={theme === "dark" ? EmojiTheme.DARK : EmojiTheme.LIGHT}
                        onEmojiClick={(d) => setMessage((c) => c + d.emoji)}
                        skinTonesDisabled height={350} width={300}
                        style={{ width: "100%", maxWidth: "100%" } as React.CSSProperties}
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="relative">
                <button type="button" onClick={() => { setShowEmoji(false); setShowGif((v) => !v); }} className="px-1.5 py-1 text-[10px] font-bold border border-[var(--muted)] text-[var(--muted)] hover:text-[var(--accent)] hover:border-[var(--accent)] rounded transition-colors">
                  GIF
                </button>
                {showGif && (
                  <>
                    <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onMouseDown={() => setShowGif(false)} />
                    <GifPicker onSelect={handleGifSelect} onClose={() => setShowGif(false)} openUp />
                  </>
                )}
              </div>
            </div>
          )}

          {/* Textarea */}
          <textarea
            ref={inputRef}
            value={message}
            rows={1}
            onChange={(e) => { setMessage(e.target.value); adjustTextarea(e.target); }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(e as unknown as React.FormEvent); } }}
            onFocus={() => setActionsExpanded(false)}
            onBlur={() => { if (!message.trim() && mediaPreview.length === 0) setActionsExpanded(true); }}
            placeholder={replyTo ? `Reply to ${replyTo.sender.displayName}…` : "Message…"}
            className="flex-1 px-4 py-2.5 rounded-2xl bg-[var(--hover)] outline-none text-sm resize-none overflow-hidden min-h-[40px] max-h-[120px]"
            style={{ height: "40px" }}
          />

          <button
            type="submit"
            disabled={(!message.trim() && mediaPreview.length === 0) || isPending || uploading}
            className="p-2 flex-shrink-0 text-[var(--accent)] disabled:opacity-40 transition-colors"
          >
            <Send size={20} />
          </button>
        </div>
      </form>}

      {/* Forward modal */}
      {showForwardModal && (
        <ForwardModal
          message={showForwardModal}
          currentConversationId={conversationId as string}
          onClose={() => setShowForwardModal(null)}
        />
      )}
    </div>
  );
}

function ForwardModal({ message, currentConversationId, onClose }: {
  message: MessageWithSender;
  currentConversationId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function forward(user: SafeUser | null, existingConvId: string | null) {
    if (loadingId) return;
    setLoadingId(existingConvId ?? user?.id ?? "");
    try {
      let targetConvId = existingConvId;
      if (!targetConvId && user) {
        // New 1:1 conversation
        const res = await fetch("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipientId: user.id,
            message: message.content || "📎 Media",
          }),
        });
        if (!res.ok) return;
        const d = await res.json();
        targetConvId = d.data.conversation.id;
        // If the message has media and we just created the conv with text, send media separately
        if (message.mediaUrls?.length && message.content) {
          await fetch(`/api/messages/${targetConvId}/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mediaUrls: message.mediaUrls }),
          });
        }
      } else if (targetConvId) {
        // Existing conversation (1:1 or group)
        const body: Record<string, unknown> = {};
        if (message.content) body.content = message.content;
        if (message.mediaUrls?.length) body.mediaUrls = message.mediaUrls;
        const res = await fetch(`/api/messages/${targetConvId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) return;
      }
      onClose();
      if (targetConvId) router.push(`/messages/${targetConvId}`);
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <UserPickerSheet
      title="Forward to"
      onClose={onClose}
      onSelect={forward}
      excludeConvIds={[currentConversationId]}
      loadingId={loadingId}
    />
  );
}
