"use client";

import { useScrollStore } from "@/store/scrollStore";
import { cn } from "@/lib/utils";

type Props = { children: React.ReactNode; className?: string };

export function MobilePageHeader({ children, className }: Props) {
  const navVisible = useScrollStore((s) => s.navVisible);
  return (
    <div
      className={cn(
        "sticky top-0 z-10 transition-transform duration-300 ease-in-out lg:transform-none",
        !navVisible && "-translate-y-full",
        className
      )}
    >
      {children}
    </div>
  );
}
