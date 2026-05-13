"use client";

import { create } from "zustand";

export type DmNotification = {
  id: string;
  conversationId: string;
  senderName: string;
  senderAvatar: string | null;
  content: string | null;
  type?: "message" | "reply" | "reaction" | "request";
  emoji?: string | null;
  isGroup?: boolean;
  groupName?: string | null;
  groupAvatar?: string | null;
  isSystem?: boolean;
};

type Store = {
  notifications: DmNotification[];
  unreadCount: number;
  push: (n: DmNotification) => void;
  dismiss: (id: string) => void;
  setUnreadCount: (n: number) => void;
  incrementUnread: () => void;
  resetUnread: () => void;
};

export const useDmNotificationStore = create<Store>((set) => ({
  notifications: [],
  unreadCount: 0,
  push: (n) =>
    set((s) => ({
      notifications: [n, ...s.notifications.filter((x) => x.id !== n.id)].slice(0, 3),
    })),
  dismiss: (id) =>
    set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) })),
  setUnreadCount: (n) => set({ unreadCount: n }),
  incrementUnread: () => set((s) => ({ unreadCount: s.unreadCount + 1 })),
  resetUnread: () => set({ unreadCount: 0 }),
}));
