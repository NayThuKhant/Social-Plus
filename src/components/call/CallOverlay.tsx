"use client";

import { useEffect, useRef, useState } from "react";
import {
  Room,
  RoomEvent,
  Track,
  type RemoteParticipant,
  type RemoteTrackPublication,
  type LocalTrackPublication,
} from "livekit-client";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Minimize2, Maximize2 } from "lucide-react";
import { Avatar } from "@/components/shared/Avatar";
import { useCallStore } from "@/store/callStore";
import { getSocket } from "@/hooks/useGlobalSocket";
import { logCall } from "@/lib/callLog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const LIVEKIT_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL!;

// Module-level room ref shared between ActiveCallScreen and the minimized pill
// so mic toggle works whether the full screen is mounted or not.
let _activeRoom: Room | null = null;

async function sharedToggleMic() {
  const store = useCallStore.getState();
  if (!_activeRoom) return;
  const next = !store.micOn;
  try {
    await _activeRoom.localParticipant.setMicrophoneEnabled(next);
    store.setMicOn(next);
  } catch {
    toast.warning("Microphone not available");
  }
}

// ── Minimized floating pill (outgoing call / active call) ────────────────────

function MinimizedPill({ onExpand, onHangUp }: { onExpand: () => void; onHangUp: () => void }) {
  const { peerName, peerAvatar, status, micOn } = useCallStore();
  const isActive = status === "active";

  return (
    <div
      className="fixed bottom-20 right-4 z-[200] flex items-center gap-2 bg-zinc-900 border border-white/10 rounded-full shadow-2xl px-3 py-2 select-none"
      onClick={onExpand}
    >
      {/* Avatar with online dot */}
      <div className="relative flex-shrink-0 cursor-pointer">
        <Avatar src={peerAvatar} alt={peerName ?? ""} size="xs" />
        <span className={cn(
          "absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-zinc-900",
          isActive ? "bg-green-400" : "bg-yellow-400 animate-pulse"
        )} />
      </div>

      {/* Name + status */}
      <div className="cursor-pointer">
        <p className="text-white text-xs font-semibold max-w-[90px] truncate leading-none">{peerName}</p>
        <p className={cn("text-[10px] font-medium mt-0.5", isActive ? "text-green-400" : "text-yellow-400 animate-pulse")}>
          {status === "calling" ? "Calling…" : "In call"}
        </p>
      </div>

      {/* Mic toggle — only when in an active call */}
      {isActive && (
        <button
          onClick={(e) => { e.stopPropagation(); sharedToggleMic(); }}
          className={cn(
            "w-7 h-7 rounded-full flex items-center justify-center transition-colors flex-shrink-0",
            micOn ? "bg-white/15 hover:bg-white/25" : "bg-rose-500/20 ring-1 ring-rose-500"
          )}
          aria-label={micOn ? "Mute" : "Unmute"}
        >
          {micOn
            ? <Mic size={13} className="text-white" />
            : <MicOff size={13} className="text-rose-400" />}
        </button>
      )}

      {/* Hang up */}
      <button
        onClick={(e) => { e.stopPropagation(); onHangUp(); }}
        className="w-7 h-7 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-600 transition-colors flex-shrink-0"
        aria-label="End call"
      >
        <PhoneOff size={13} className="text-white" />
      </button>
    </div>
  );
}

// ── Calling screen (outgoing, waiting for answer) ────────────────────────────

function CallingScreen() {
  const { peerName, peerAvatar, peerId, conversationId, isVideo, reset, setMinimized } = useCallStore();

  function cancel() {
    if (conversationId) logCall(conversationId, "missed", { isVideo });
    getSocket().emit("call:end", { targetUserId: peerId });
    reset();
  }

  return (
    <div className="fixed inset-0 bg-zinc-900 z-[100] flex flex-col items-center justify-center gap-10">
      <button
        onClick={() => setMinimized(true)}
        className="absolute top-12 right-4 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
        aria-label="Minimize"
      >
        <Minimize2 size={18} className="text-white" />
      </button>

      <div className="flex flex-col items-center gap-4">
        <div className="ring-4 ring-white/20 rounded-full animate-pulse">
          <Avatar src={peerAvatar} alt={peerName ?? ""} size="xl" />
        </div>
        <div className="text-center">
          <p className="text-white font-bold text-2xl">{peerName}</p>
          <p className="text-white/50 mt-1 text-sm animate-pulse">Calling…</p>
        </div>
      </div>

      <button
        onClick={cancel}
        className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-600 transition-colors"
      >
        <PhoneOff size={28} className="text-white" />
      </button>
    </div>
  );
}

// ── Active call screen ───────────────────────────────────────────────────────

function ActiveCallScreen() {
  const { token, isVideo, peerName, peerAvatar, peerId, reset, setMinimized, micOn, setMicOn } = useCallStore();
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const audioElementsRef = useRef<HTMLAudioElement[]>([]);

  const [cameraOn, setCameraOn] = useState(isVideo);
  const [remoteHasVideo, setRemoteHasVideo] = useState(false);
  const [localHasVideo, setLocalHasVideo] = useState(false);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    const room = new Room({ adaptiveStream: true, dynacast: true });
    _activeRoom = room;

    function onTrackSubscribed(
      track: Parameters<typeof room.on<RoomEvent.TrackSubscribed>>[1] extends (...args: infer A) => void ? A[0] : never,
      _pub: RemoteTrackPublication,
      _participant: RemoteParticipant
    ) {
      if (track.kind === Track.Kind.Video) {
        setRemoteHasVideo(true);
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = new MediaStream([track.mediaStreamTrack]);
      } else if (track.kind === Track.Kind.Audio) {
        const el = track.attach() as HTMLAudioElement;
        el.autoplay = true;
        document.body.appendChild(el);
        audioElementsRef.current.push(el);
      }
    }

    function onTrackUnsubscribed(
      track: Parameters<typeof room.on<RoomEvent.TrackUnsubscribed>>[1] extends (...args: infer A) => void ? A[0] : never
    ) {
      if (track.kind === Track.Kind.Video) setRemoteHasVideo(false);
      track.detach();
    }

    function onLocalTrackPublished(pub: LocalTrackPublication) {
      const track = pub.track;
      if (!track) return;
      if (track.kind === Track.Kind.Video) {
        setLocalHasVideo(true);
        if (localVideoRef.current) localVideoRef.current.srcObject = new MediaStream([track.mediaStreamTrack!]);
      }
    }

    function onLocalTrackUnpublished(pub: LocalTrackPublication) {
      if (pub.track?.kind === Track.Kind.Video) setLocalHasVideo(false);
    }

    room.on(RoomEvent.TrackSubscribed, onTrackSubscribed);
    room.on(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);
    room.on(RoomEvent.LocalTrackPublished, onLocalTrackPublished);
    room.on(RoomEvent.LocalTrackUnpublished, onLocalTrackUnpublished);
    room.on(RoomEvent.Connected, () => { if (!cancelled) setConnected(true); });
    room.on(RoomEvent.Disconnected, () => { if (!cancelled) useCallStore.getState().reset(); });

    room.connect(LIVEKIT_URL, token).then(async () => {
      if (cancelled) return;
      try {
        await room.localParticipant.setMicrophoneEnabled(true);
        setMicOn(true);
      } catch {
        toast.warning("Microphone not available");
        setMicOn(false);
      }
      if (isVideo) {
        try {
          await room.localParticipant.setCameraEnabled(true);
        } catch {
          toast.warning("Camera not available — audio only");
          if (!cancelled) setCameraOn(false);
        }
      }
    }).catch((err) => {
      if (cancelled) return;
      console.error("LiveKit connect error:", err);
      toast.error("Failed to connect to call");
      reset();
    });

    return () => {
      cancelled = true;
      room.off(RoomEvent.TrackSubscribed, onTrackSubscribed);
      room.off(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);
      room.off(RoomEvent.LocalTrackPublished, onLocalTrackPublished);
      room.off(RoomEvent.LocalTrackUnpublished, onLocalTrackUnpublished);
      audioElementsRef.current.forEach((el) => el.remove());
      audioElementsRef.current = [];
      room.disconnect();
      _activeRoom = null;
    };
  }, [token, isVideo, reset, setMicOn]);

  async function toggleCamera() {
    const room = _activeRoom;
    if (!room || !isVideo) return;
    const next = !cameraOn;
    try {
      await room.localParticipant.setCameraEnabled(next);
      setCameraOn(next);
    } catch {
      toast.warning("Camera not available");
      setCameraOn(false);
    }
  }

  function hangUp() {
    const state = useCallStore.getState();
    if (state.isInitiator && state.conversationId) {
      const duration = state.callStartedAt
        ? Math.floor((Date.now() - state.callStartedAt) / 1000)
        : undefined;
      logCall(state.conversationId, "ended", { isVideo: state.isVideo, durationSeconds: duration });
    }
    getSocket().emit("call:end", { targetUserId: peerId });
    _activeRoom?.disconnect();
    reset();
  }

  return (
    <div className="fixed inset-0 bg-zinc-900 z-[100] flex flex-col">
      <div className="flex-1 relative overflow-hidden">
        {isVideo ? (
          <>
            <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
            {!remoteHasVideo && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                <Avatar src={peerAvatar} alt={peerName ?? ""} size="xl" />
                <p className="text-white font-bold text-xl">{peerName}</p>
                {!connected && <p className="text-white/50 text-sm animate-pulse">Connecting…</p>}
              </div>
            )}
            <div className="absolute bottom-4 right-4 w-28 h-40 rounded-2xl overflow-hidden bg-zinc-800 shadow-2xl border border-white/10">
              {localHasVideo
                ? <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
                : <div className="w-full h-full flex items-center justify-center"><VideoOff size={20} className="text-white/40" /></div>
              }
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-6">
            <Avatar src={peerAvatar} alt={peerName ?? ""} size="xl" />
            <div className="text-center">
              <p className="text-white font-bold text-2xl">{peerName}</p>
              <p className={cn("text-sm mt-1", connected ? "text-green-400" : "text-white/50 animate-pulse")}>
                {connected ? "Connected" : "Connecting…"}
              </p>
            </div>
          </div>
        )}

        <button
          onClick={() => setMinimized(true)}
          className="absolute top-12 right-4 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center hover:bg-black/60 transition-colors"
          aria-label="Minimize"
        >
          <Minimize2 size={18} className="text-white" />
        </button>
      </div>

      <div className="flex items-center justify-center gap-5 py-8 px-4 bg-black/60 backdrop-blur-sm">
        {/* Mic */}
        <button
          onClick={sharedToggleMic}
          className={cn(
            "w-14 h-14 rounded-full flex items-center justify-center transition-colors",
            micOn ? "bg-white/20 hover:bg-white/30" : "bg-white/10 ring-2 ring-rose-500"
          )}
          aria-label={micOn ? "Mute" : "Unmute"}
        >
          {micOn ? <Mic size={22} className="text-white" /> : <MicOff size={22} className="text-rose-400" />}
        </button>

        {/* Camera */}
        {isVideo && (
          <button
            onClick={toggleCamera}
            className={cn(
              "w-14 h-14 rounded-full flex items-center justify-center transition-colors",
              cameraOn ? "bg-white/20 hover:bg-white/30" : "bg-white/10 ring-2 ring-rose-500"
            )}
            aria-label={cameraOn ? "Turn off camera" : "Turn on camera"}
          >
            {cameraOn ? <Video size={22} className="text-white" /> : <VideoOff size={22} className="text-rose-400" />}
          </button>
        )}

        {/* Hang up */}
        <button
          onClick={hangUp}
          className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-600 transition-colors"
          aria-label="End call"
        >
          <PhoneOff size={28} className="text-white" />
        </button>
      </div>
    </div>
  );
}

// ── Root export ──────────────────────────────────────────────────────────────

export function CallOverlay() {
  const { status, minimized, setMinimized, peerId, reset } = useCallStore();

  function hangUpFromPill() {
    const state = useCallStore.getState();
    if (state.status === "calling" && state.conversationId) {
      logCall(state.conversationId, "missed", { isVideo: state.isVideo });
    } else if (state.status === "active" && state.isInitiator && state.conversationId) {
      const duration = state.callStartedAt
        ? Math.floor((Date.now() - state.callStartedAt) / 1000)
        : undefined;
      logCall(state.conversationId, "ended", { isVideo: state.isVideo, durationSeconds: duration });
    }
    getSocket().emit("call:end", { targetUserId: peerId });
    _activeRoom?.disconnect();
    reset();
  }

  if (status === "idle" || status === "receiving") return null;

  if (minimized) {
    return <MinimizedPill onExpand={() => setMinimized(false)} onHangUp={hangUpFromPill} />;
  }

  if (status === "calling") return <CallingScreen />;
  if (status === "active") return <ActiveCallScreen />;
  return null;
}

// ── Expand button shown on top of app content when minimized ─────────────────
// (imported by IncomingCallModal too — kept here for colocation)
export { Maximize2 };
