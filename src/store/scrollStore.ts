import { create } from "zustand";

type ScrollStore = {
  navVisible: boolean;
  setNavVisible: (v: boolean) => void;
};

export const useScrollStore = create<ScrollStore>((set) => ({
  navVisible: true,
  setNavVisible: (navVisible) => set({ navVisible }),
}));
