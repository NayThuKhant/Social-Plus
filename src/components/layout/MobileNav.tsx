"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Bell, Mail, Bookmark, List, Settings, LogOut, X, User, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { useTheme } from "@/lib/theme";
import { useQuery } from "@tanstack/react-query";
import { useDmNotificationStore } from "@/store/dmNotificationStore";
import { Avatar } from "@/components/shared/Avatar";
import { useState } from "react";
import { useScrollStore } from "@/store/scrollStore";

const primaryNav = [
  { href: "/",             icon: Home,   label: "Home" },
  { href: "/explore",      icon: Search, label: "Explore" },
  { href: "/notifications",icon: Bell,   label: "Notifications" },
  { href: "/messages",     icon: Mail,   label: "Messages" },
];

const drawerItems = [
  { href: "/bookmarks", icon: Bookmark, label: "Bookmarks" },
  { href: "/lists",     icon: List,     label: "Lists" },
  { href: "/settings",  icon: Settings, label: "Settings" },
];

export function MobileNav() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const { theme, setTheme } = useTheme();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data: unreadData } = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: () => fetch("/api/notifications/unread").then((r) => r.json()),
    enabled: !!user,
  });
  const unreadCount: number = unreadData?.data?.count ?? 0;
  const unreadDmCount = useDmNotificationStore((s) => s.unreadCount);

  const navVisible = useScrollStore((s) => s.navVisible);
  const BADGE_MAX = 99;
  function formatBadge(n: number) { return n > BADGE_MAX ? `${BADGE_MAX}+` : n; }

  return (
    <>
      {/* Bottom navigation bar */}
      <nav className={cn(
        "fixed bottom-0 left-0 right-0 bg-[var(--background)] border-t border-[var(--border)] flex items-center justify-around px-2 py-2 z-40 lg:hidden",
        "transition-transform duration-300 ease-in-out",
        navVisible ? "translate-y-0" : "translate-y-full"
      )}>
        {primaryNav.map(({ href, icon: Icon, label }) => {
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
          const badge = href === "/notifications" ? unreadCount : href === "/messages" ? unreadDmCount : 0;
          return (
            <Link key={href} href={href} aria-label={label} className="p-2 relative">
              <Icon
                size={26}
                strokeWidth={isActive ? 2.5 : 2}
                className={isActive ? "text-[var(--foreground)]" : "text-[var(--muted)]"}
              />
              {badge > 0 && (
                <span className="absolute top-1 right-1 bg-[var(--accent)] text-white text-[10px] leading-none rounded-full min-w-[16px] h-4 flex items-center justify-center font-bold px-0.5">
                  {formatBadge(badge)}
                </span>
              )}
            </Link>
          );
        })}

        {/* Avatar / More button */}
        <button
          onClick={() => setDrawerOpen(true)}
          className="p-1 relative"
          aria-label="More options"
        >
          <div className={cn(
            "w-7 h-7 rounded-full ring-2 transition-all overflow-hidden flex items-center justify-center",
            drawerOpen ? "ring-[var(--accent)]" : "ring-transparent",
            !user?.avatarUrl && "bg-[var(--accent)]"
          )}>
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.displayName ?? ""} className="w-full h-full object-cover" />
            ) : (
              <span className="text-white font-bold text-xs leading-none">
                {(user?.displayName ?? user?.username ?? "?").charAt(0).toUpperCase()}
              </span>
            )}
          </div>
        </button>
      </nav>

      {/* Drawer backdrop */}
      {drawerOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-50 lg:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Slide-up drawer */}
      <div
        className={cn(
          "fixed bottom-0 left-0 right-0 bg-[var(--background)] rounded-t-2xl z-50 lg:hidden transition-transform duration-300",
          drawerOpen ? "translate-y-0" : "translate-y-full"
        )}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-[var(--border)]" />
        </div>

        {/* Profile header — display only */}
        {user && (
          <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--border)]">
            <Avatar src={user.avatarUrl} alt={user.displayName} size="md" />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm truncate">{user.displayName}</p>
              <p className="text-[var(--muted)] text-xs">@{user.username}</p>
            </div>
          </div>
        )}

        {/* Drawer nav items */}
        <div className="py-2">
          {drawerItems.map(({ href, icon: Icon, label }) => {
            const isActive = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setDrawerOpen(false)}
                className={cn(
                  "flex items-center gap-4 px-5 py-3.5 hover:bg-[var(--hover)] transition-colors",
                  isActive ? "font-bold" : ""
                )}
              >
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-base">{label}</span>
              </Link>
            );
          })}
        </div>

        {/* Bottom: theme toggle + profile + logout */}
        <div className="border-t border-[var(--border)] pb-8">
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="flex items-center gap-4 px-5 py-3.5 w-full hover:bg-[var(--hover)] transition-colors"
          >
            {theme === "dark" ? <Sun size={22} /> : <Moon size={22} />}
            <span className="text-base flex-1 text-left">
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </span>
          </button>
          {user && (
            <Link
              href={`/${user.username}`}
              onClick={() => setDrawerOpen(false)}
              className="flex items-center gap-4 px-5 py-3.5 hover:bg-[var(--hover)] transition-colors"
            >
              <User size={22} />
              <span className="text-base">Profile</span>
            </Link>
          )}
          <button
            onClick={() => { setDrawerOpen(false); logout(); }}
            className="flex items-center gap-4 px-5 py-3.5 w-full hover:bg-[var(--hover)] transition-colors text-red-500"
          >
            <LogOut size={22} />
            <span className="text-base">Log out</span>
          </button>
        </div>
      </div>
    </>
  );
}
