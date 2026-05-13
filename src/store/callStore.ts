import { create } from "zustand";

export type CallStatus = "idle" | "calling" | "receiving" | "active";

type CallParams = {
  peerId: string;
  peerName: string;
  peerAvatar: string | null;
  isVideo: boolean;
  conversationId: string;
  roomName: string;
  isGroup?: boolean;
  memberIds?: string[];
};

type CallStore = {
  status: CallStatus;
  peerId: string | null;
  peerName: string | null;
  peerAvatar: string | null;
  isVideo: boolean;
  conversationId: string | null;
  roomName: string | null;
  token: string | null;
  isGroup: boolean;
  memberIds: string[];
  minimized: boolean;
  micOn: boolean;
  isInitiator: boolean;
  callStartedAt: number | null;

  startOutgoing: (p: CallParams) => void;
  receiveIncoming: (p: CallParams) => void;
  setToken: (token: string) => void;
  setActive: () => void;
  setMinimized: (v: boolean) => void;
  setMicOn: (v: boolean) => void;
  reset: () => void;
};

const IDLE: Omit<CallStore, keyof Omit<CallStore, "status" | "peerId" | "peerName" | "peerAvatar" | "isVideo" | "conversationId" | "roomName" | "token" | "isGroup" | "memberIds" | "minimized" | "micOn" | "isInitiator" | "callStartedAt">> = {
  status: "idle",
  peerId: null,
  peerName: null,
  peerAvatar: null,
  isVideo: false,
  conversationId: null,
  roomName: null,
  token: null,
  isGroup: false,
  memberIds: [],
  minimized: false,
  micOn: true,
  isInitiator: false,
  callStartedAt: null,
};

export const useCallStore = create<CallStore>((set) => ({
  ...IDLE,
  startOutgoing: (p) => set({ ...p, isGroup: p.isGroup ?? false, memberIds: p.memberIds ?? [], status: "calling", token: null, minimized: false, micOn: true, isInitiator: true, callStartedAt: null }),
  receiveIncoming: (p) => set({ ...p, isGroup: p.isGroup ?? false, memberIds: p.memberIds ?? [], status: "receiving", token: null, minimized: false, micOn: true, isInitiator: false, callStartedAt: null }),
  setToken: (token) => set({ token }),
  setActive: () => set({ status: "active", callStartedAt: Date.now() }),
  setMinimized: (v) => set({ minimized: v }),
  setMicOn: (v) => set({ micOn: v }),
  reset: () => set({ ...IDLE }),
}));
