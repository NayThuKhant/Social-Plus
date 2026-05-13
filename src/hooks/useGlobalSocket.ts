"use client";

import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/authStore";
import { usePathname } from "next/navigation";
import { useDmNotificationStore } from "@/store/dmNotificationStore";
import { useNotificationPopupStore } from "@/store/notificationPopupStore";
import { useCallStore } from "@/store/callStore";
import { browserNotify } from "@/lib/browserNotify";
import { playRing, stopRing, playCallConnected, playCallEnded } from "@/lib/sound";
import { toast } from "sonner";
import { logCall } from "@/lib/callLog";

// One socket for the entire session — never recreated on navigation
let socket: ReturnType<typeof io> | null = null;

// Auto-decline timer — receiver side (cleared when callee accepts/declines)
let autoDeclineTimer: ReturnType<typeof setTimeout> | null = null;
// Auto-cancel timer — caller side (cleared the moment call:accepted arrives)
let autoCancelTimer: ReturnType<typeof setTimeout> | null = null;

function clearAutoDecline() {
  if (autoDeclineTimer) { clearTimeout(autoDeclineTimer); autoDeclineTimer = null; }
}
function clearAutoCancel() {
  if (autoCancelTimer) { clearTimeout(autoCancelTimer); autoCancelTimer = null; }
}

// Called from the conversation page when a call is initiated
export function startCallerAutoCancel(targetUserId: string) {
  clearAutoCancel();
  autoCancelTimer = setTimeout(() => {
    const state = useCallStore.getState();
    if (state.status === "calling") {
      stopRing();
      socket?.emit("call:end", { targetUserId });
      if (state.conversationId) {
        logCall(state.conversationId, "missed", { isVideo: state.isVideo });
      }
      state.reset();
    }
    autoCancelTimer = null;
  }, 30_000);
}

export function getSocket() {
  if (!socket) {
    socket = io({ path: "/api/socketio", addTrailingSlash: false });
  }
  return socket;
}

export function useGlobalSocket() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const pathname = usePathname();

  // Track pathname in a ref so handlers always see the current page
  // without making it a dependency (which would tear down socket on every nav)
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  });

  useEffect(() => {
    if (!user) return;

    const sock = getSocket();

    function joinUserRoom() {
      sock.emit("join-user", user!.id);
    }

    // Always emit (socket.io buffers if not yet connected) and re-join on reconnect
    joinUserRoom();
    sock.on("connect", joinUserRoom);

    function onNewDm({
      message,
      conversationId,
      isReply,
      isRequest,
      type,
      emoji,
      isGroup,
      groupName,
      groupAvatar,
      isSystem,
    }: {
      message: { id: string; content: string | null; sender: { displayName: string; avatarUrl?: string | null } } | null;
      conversationId: string;
      isReply?: boolean;
      isRequest?: boolean;
      type?: "reaction";
      emoji?: string | null;
      isGroup?: boolean;
      groupName?: string | null;
      groupAvatar?: string | null;
      isSystem?: boolean;
    }) {
      const inConversation = pathnameRef.current === `/messages/${conversationId}`;

      // Reaction notification — no unread bump, no conv list refresh
      if (type === "reaction") {
        if (!inConversation && message) {
          useDmNotificationStore.getState().push({
            id: `${message.id}-reaction`,
            conversationId,
            senderName: message.sender.displayName,
            senderAvatar: message.sender.avatarUrl ?? null,
            content: null,
            type: "reaction",
            emoji,
          });
        }
        return;
      }

      // Regular message / reply / request / group system message
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      if (!message || inConversation) return;

      if (!isSystem) useDmNotificationStore.getState().incrementUnread();
      useDmNotificationStore.getState().push({
        id: message.id,
        conversationId,
        senderName: message.sender.displayName,
        senderAvatar: message.sender.avatarUrl ?? null,
        content: message.content,
        type: isRequest ? "request" : isReply ? "reply" : "message",
        isGroup,
        groupName,
        groupAvatar,
        isSystem,
      });

      const title = isGroup ? (groupName ?? "Group") : message.sender.displayName;
      const bodyText = isSystem
        ? (message.content ?? "")
        : isRequest
          ? "sent you a message request"
          : isReply
            ? "replied to a message"
            : (message.content ?? "📎 Sent a media message");
      browserNotify(title, {
        body: bodyText,
        tag: `dm-${message.id}`,
        url: `/messages/${conversationId}`,
      });
    }

    function onBlockChanged() {
      queryClient.invalidateQueries({ queryKey: ["blockStatus"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    }

    function onConvAccepted({ conversationId }: { conversationId: string }) {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["conversation", conversationId] });
    }

    function onConvDeclined() {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    }

    function onConvRemoved({ conversationId }: { conversationId: string }) {
      // Immediately remove from conversations list cache
      queryClient.setQueryData(
        ["conversations"],
        (old: { data: Array<{ id: string }> } | undefined) => {
          if (!old?.data) return old;
          return { ...old, data: old.data.filter((c) => c.id !== conversationId) };
        }
      );
      queryClient.removeQueries({ queryKey: ["conversation", conversationId] });
    }

    function onConvCleared({ conversationId: cid }: { conversationId: string }) {
      queryClient.removeQueries({ queryKey: ["messages", cid] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    }

    function onNewNotification(payload: { type: string; actorName: string; actorAvatar: string | null; postId?: string | null } | null) {
      queryClient.setQueryData(
        ["notifications", "unread"],
        (old: { data: { count: number } } | undefined) => ({
          data: { count: (old?.data?.count ?? 0) + 1 },
        })
      );
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      if (payload?.actorName) {
        useNotificationPopupStore.getState().push(payload);

        const notifLabels: Record<string, string> = {
          LIKE: "liked your post",
          REPOST: "reposted your post",
          FOLLOW: "followed you",
          REPLY: "replied to your post",
          MENTION: "mentioned you",
          QUOTE: "quoted your post",
        };
        browserNotify(payload.actorName, {
          body: notifLabels[payload.type] ?? "interacted with you",
          tag: `notif-${payload.type}`,
          url: payload.postId ? `/post/${payload.postId}` : "/notifications",
        });
      }
    }

    // ── Call signaling ──
    function onCallIncoming(payload: {
      callerId: string; callerName: string; callerAvatar: string | null;
      roomName: string; isVideo: boolean; conversationId: string;
      isGroup?: boolean; groupName?: string | null; groupAvatar?: string | null;
    }) {
      // Ignore duplicate events — don't reset a call that's already in progress
      const currentStatus = useCallStore.getState().status;
      if (currentStatus !== "idle") return;

      const displayName = payload.isGroup ? (payload.groupName ?? "Group") : payload.callerName;
      const displayAvatar = payload.isGroup ? (payload.groupAvatar ?? null) : payload.callerAvatar;

      useCallStore.getState().receiveIncoming({
        peerId: payload.callerId,
        peerName: displayName,
        peerAvatar: displayAvatar,
        roomName: payload.roomName,
        isVideo: payload.isVideo,
        conversationId: payload.conversationId,
        isGroup: payload.isGroup,
      });

      playRing();

      browserNotify(`${displayName} is calling…`, {
        body: payload.isVideo ? "Incoming video call" : "Incoming voice call",
        tag: "call",
      });

      // Auto-decline after 30 s if the user doesn't respond
      clearAutoDecline();
      autoDeclineTimer = setTimeout(() => {
        const state = useCallStore.getState();
        if (state.status === "receiving") {
          stopRing();
          sock.emit("call:decline", { callerId: payload.callerId });
          state.reset();
          toast(`Missed call from ${displayName}`);
        }
        autoDeclineTimer = null;
      }, 30_000);
    }

    async function onCallAccepted() {
      // Clear the caller-side 10s cancel timer FIRST — before the async token fetch.
      // If cleared only after setActive(), a slow network could let the timer fire
      // mid-fetch with status still "calling", causing a spurious call:end.
      clearAutoCancel();
      clearAutoDecline();
      stopRing();
      playCallConnected();
      const state = useCallStore.getState();
      try {
        const res = await fetch("/api/calls/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomName: state.roomName }),
        });
        const data = await res.json();
        state.setToken(data.data.token);
        state.setActive();
      } catch {
        toast.error("Failed to start call");
        state.reset();
      }
    }

    function onCallDeclined() {
      const state = useCallStore.getState();
      // In group calls: if one member declines but another already accepted, stay in call
      if (state.status === "active") return;
      clearAutoCancel();
      clearAutoDecline();
      stopRing();
      playCallEnded();
      if (state.isInitiator && state.conversationId) {
        logCall(state.conversationId, "missed", { isVideo: state.isVideo });
      }
      state.reset();
      toast("Call declined");
    }

    function onCallEnded() {
      const state = useCallStore.getState();
      clearAutoCancel();
      clearAutoDecline();
      stopRing();
      playCallEnded();
      // Only the initiator logs, and only if the call was actually connected
      if (state.isInitiator && state.conversationId && state.status === "active") {
        const duration = state.callStartedAt
          ? Math.floor((Date.now() - state.callStartedAt) / 1000)
          : undefined;
        logCall(state.conversationId, "ended", { isVideo: state.isVideo, durationSeconds: duration });
      }
      state.reset();
      toast("Call ended");
    }

    // Another tab of this same account accepted or declined — stop ringing here
    function onCallAcceptedElsewhere() {
      clearAutoDecline();
      stopRing();
      if (useCallStore.getState().status === "receiving") {
        useCallStore.getState().reset();
      }
    }

    function onCallDeclinedElsewhere() {
      clearAutoDecline();
      stopRing();
      if (useCallStore.getState().status === "receiving") {
        useCallStore.getState().reset();
      }
    }

    sock.on("new-dm", onNewDm);
    sock.on("new-notification", onNewNotification);
    sock.on("block-changed", onBlockChanged);
    sock.on("conv-accepted", onConvAccepted);
    sock.on("conv-declined", onConvDeclined);
    sock.on("conv-removed", onConvRemoved);
    sock.on("conv-cleared", onConvCleared);
    sock.on("call:incoming", onCallIncoming);
    sock.on("call:accepted", onCallAccepted);
    sock.on("call:declined", onCallDeclined);
    sock.on("call:ended", onCallEnded);
    sock.on("call:accepted-elsewhere", onCallAcceptedElsewhere);
    sock.on("call:declined-elsewhere", onCallDeclinedElsewhere);

    // Cleanup only removes listeners — socket stays connected and in user room
    return () => {
      sock.off("connect", joinUserRoom);
      sock.off("new-dm", onNewDm);
      sock.off("new-notification", onNewNotification);
      sock.off("block-changed", onBlockChanged);
      sock.off("conv-accepted", onConvAccepted);
      sock.off("conv-declined", onConvDeclined);
      sock.off("conv-removed", onConvRemoved);
      sock.off("conv-cleared", onConvCleared);
      sock.off("call:incoming", onCallIncoming);
      sock.off("call:accepted", onCallAccepted);
      sock.off("call:declined", onCallDeclined);
      sock.off("call:ended", onCallEnded);
      sock.off("call:accepted-elsewhere", onCallAcceptedElsewhere);
      sock.off("call:declined-elsewhere", onCallDeclinedElsewhere);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, queryClient]); // pathname intentionally excluded — use pathnameRef instead
}
