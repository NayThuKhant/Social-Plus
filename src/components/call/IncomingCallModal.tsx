"use client";

import { Phone, PhoneOff, Video, Minimize2 } from "lucide-react";
import { Avatar } from "@/components/shared/Avatar";
import { useCallStore } from "@/store/callStore";
import { useAuthStore } from "@/store/authStore";
import { getSocket } from "@/hooks/useGlobalSocket";
import { stopRing, playCallConnected, playCallEnded } from "@/lib/sound";
import { cn } from "@/lib/utils";

export function IncomingCallModal() {
  const { status, peerName, peerAvatar, peerId, roomName, isVideo, setToken, setActive, reset, minimized, setMinimized } = useCallStore();
  const { user } = useAuthStore();

  if (status !== "receiving") return null;

  async function accept() {
    stopRing();
    playCallConnected();
    const res = await fetch("/api/calls/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomName }),
    });
    const data = await res.json();
    setToken(data.data.token);
    setActive();
    setMinimized(false);
    getSocket().emit("call:accept", { callerId: peerId, calleeId: user?.id });
  }

  function decline() {
    stopRing();
    playCallEnded();
    getSocket().emit("call:decline", { callerId: peerId, calleeId: user?.id });
    reset();
  }

  // ── Minimized pill ───────────────────────────────────────────────────────
  if (minimized) {
    return (
      <div
        className="fixed bottom-20 right-4 z-[200] flex items-center gap-2 bg-zinc-900 border border-white/10 rounded-full shadow-2xl px-3 py-2 select-none cursor-pointer"
        onClick={() => setMinimized(false)}
      >
        {/* Pulsing avatar */}
        <div className="relative flex-shrink-0">
          <div className="ring-2 ring-green-400/60 rounded-full animate-pulse">
            <Avatar src={peerAvatar} alt={peerName ?? ""} size="xs" />
          </div>
        </div>

        {/* Label */}
        <div>
          <p className="text-white text-xs font-semibold max-w-[80px] truncate leading-none">{peerName}</p>
          <p className="text-[10px] text-green-400 animate-pulse font-medium mt-0.5">
            {isVideo ? "Video call…" : "Voice call…"}
          </p>
        </div>

        {/* Decline */}
        <button
          onClick={(e) => { e.stopPropagation(); decline(); }}
          className="w-7 h-7 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-600 transition-colors flex-shrink-0"
          aria-label="Decline"
        >
          <PhoneOff size={13} className="text-white" />
        </button>

        {/* Accept */}
        <button
          onClick={(e) => { e.stopPropagation(); accept(); }}
          className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center hover:bg-green-600 transition-colors flex-shrink-0"
          aria-label="Accept"
        >
          <Phone size={13} className="text-white" />
        </button>
      </div>
    );
  }

  // ── Full-screen modal ────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-4">
      <div className="bg-[var(--background)] rounded-3xl p-8 w-full max-w-sm flex flex-col items-center gap-6 shadow-2xl relative">
        {/* Minimize */}
        <button
          onClick={() => setMinimized(true)}
          className="absolute top-4 right-4 w-8 h-8 rounded-full hover:bg-[var(--hover)] flex items-center justify-center text-[var(--muted)] transition-colors"
          aria-label="Minimize"
        >
          <Minimize2 size={16} />
        </button>

        <div className="relative">
          <div className={cn(
            "ring-4 rounded-full animate-pulse",
            isVideo ? "ring-[var(--accent)]/30" : "ring-green-500/30"
          )}>
            <Avatar src={peerAvatar} alt={peerName ?? ""} size="xl" />
          </div>
          <span className={cn(
            "absolute -bottom-1 -right-1 rounded-full p-1.5",
            isVideo ? "bg-[var(--accent)]" : "bg-green-500"
          )}>
            {isVideo ? <Video size={14} className="text-white" /> : <Phone size={14} className="text-white" />}
          </span>
        </div>

        <div className="text-center">
          <p className="font-bold text-xl">{peerName}</p>
          <p className="text-[var(--muted)] text-sm mt-1">
            Incoming {isVideo ? "video" : "voice"} call…
          </p>
        </div>

        <div className="flex gap-10">
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={decline}
              className="w-14 h-14 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-600 transition-colors"
            >
              <PhoneOff size={24} className="text-white" />
            </button>
            <span className="text-xs text-[var(--muted)]">Decline</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={accept}
              className="w-14 h-14 rounded-full bg-green-500 flex items-center justify-center hover:bg-green-600 transition-colors"
            >
              <Phone size={24} className="text-white" />
            </button>
            <span className="text-xs text-[var(--muted)]">Accept</span>
          </div>
        </div>
      </div>
    </div>
  );
}
