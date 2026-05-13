"use client";

import { create } from "zustand";

export type NotifPopup = {
  id: string;
  type: string;
  actorName: string;
  actorAvatar: string | null;
  postId?: string | null;
};

type Store = {
  popups: NotifPopup[];
  push: (payload: Omit<NotifPopup, "id">) => void;
  dismiss: (id: string) => void;
};

export const useNotificationPopupStore = create<Store>((set) => ({
  popups: [],
  push: (payload) =>
    set((s) => ({
      popups: [
        { ...payload, id: Math.random().toString(36).slice(2) },
        ...s.popups,
      ].slice(0, 3),
    })),
  dismiss: (id) => set((s) => ({ popups: s.popups.filter((p) => p.id !== id) })),
}));
