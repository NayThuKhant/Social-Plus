"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";
import { RightSidebar } from "./RightSidebar";
import { MobileNav } from "./MobileNav";
import { PostComposerModal } from "@/components/post/PostComposerModal";
import { useAuthStore } from "@/store/authStore";
import { useGlobalSocket } from "@/hooks/useGlobalSocket";
import { requestNotificationPermission, registerServiceWorker } from "@/lib/browserNotify";
import { toast } from "sonner";
import { DmNotificationPopup } from "./DmNotificationPopup";
import { NotificationPopup } from "./NotificationPopup";
import { IncomingCallModal } from "@/components/call/IncomingCallModal";
import { CallOverlay } from "@/components/call/CallOverlay";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useDmNotificationStore } from "@/store/dmNotificationStore";
import { useScrollStore } from "@/store/scrollStore";
import type { SafeUser } from "@/types";

type Props = { user: SafeUser; children: React.ReactNode };

export function MainLayoutClient({ user, children }: Props) {
  const { setUser } = useAuthStore();
  const [composerOpen, setComposerOpen] = useState(false);

  useEffect(() => {
    registerServiceWorker();
  }, []);

  // Hide mobile nav bars when scrolling down, reveal on scroll up
  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;

    function update() {
      const y = window.scrollY;
      const { setNavVisible } = useScrollStore.getState();
      if (y < 80) {
        setNavVisible(true);
      } else if (y > lastY + 4) {
        setNavVisible(false);
      } else if (y < lastY - 4) {
        setNavVisible(true);
      }
      lastY = y;
      ticking = false;
    }

    function onScroll() {
      if (!ticking) {
        requestAnimationFrame(update);
        ticking = true;
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setUser(user);

    // Seed unread DM count from API on mount
    fetch("/api/messages/unread")
      .then((r) => r.json())
      .then((d) => useDmNotificationStore.getState().setUnreadCount(d?.data?.count ?? 0))
      .catch(() => {});

    // Prompt for notification permission via a toast so the browser dialog
    // fires in response to a real user gesture (click), not silently on load.
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      const t = setTimeout(() => {
        toast("Enable browser notifications?", {
          description: "Get notified about messages and activity even when you're on another tab.",
          action: {
            label: "Enable",
            onClick: requestNotificationPermission,
          },
          duration: 12000,
          id: "notif-permission",
        });
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [user, setUser]);

  useGlobalSocket();

  return (
    <div className="min-h-screen flex justify-center">
      <div className="w-full max-w-[1300px] flex">
        {/* Left sidebar */}
        <aside className="w-[72px] xl:w-[275px] flex-shrink-0 border-r border-[var(--border)] sticky top-0 h-screen hidden lg:block">
          <Sidebar onCompose={() => setComposerOpen(true)} />
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 border-r border-[var(--border)] pb-16 lg:pb-0">
          {children}
        </main>

        {/* Right sidebar */}
        <aside className="w-[350px] flex-shrink-0 hidden lg:block">
          <RightSidebar />
        </aside>
      </div>

      {/* Mobile nav */}
      <MobileNav />

      {/* DM notification popups */}
      <DmNotificationPopup />

      {/* Notification popups (likes, reposts, follows, etc.) */}
      <NotificationPopup />

      {/* Call UI */}
      <IncomingCallModal />
      <CallOverlay />

      {/* Post composer modal */}
      {composerOpen && (
        <PostComposerModal onClose={() => setComposerOpen(false)} />
      )}

      {/* Global confirm dialog */}
      <ConfirmDialog />
    </div>
  );
}
