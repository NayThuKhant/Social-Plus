"use client";

import { create } from "zustand";
import type { SafeUser } from "@/types";

type AuthStore = {
  user: SafeUser | null;
  setUser: (user: SafeUser | null) => void;
  logout: () => Promise<void>;
};

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  logout: async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    set({ user: null });
    window.location.href = "/login";
  },
}));
