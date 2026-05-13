"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home, Search, Bell, Mail, Bookmark, List, User, Settings, PenSquare, LogOut, MoreHorizontal, Sun, Moon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/shared/Avatar";
import { Logo } from "@/components/shared/Logo";
import { useAuthStore } from "@/store/authStore";
import { useTheme } from "@/lib/theme";
import { useQuery } from "@tanstack/react-query";
import { useDmNotificationStore } from "@/store/dmNotificationStore";

const navItems = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/explore", icon: Search, label: "Explore" },
  { href: "/notifications", icon: Bell, label: "Notifications" },
  { href: "/messages", icon: Mail, label: "Messages" },
  { href: "/bookmarks", icon: Bookmark, label: "Bookmarks" },
  { href: "/lists", icon: List, label: "Lists" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

type SidebarProps = {
  onCompose?: () => void;
};

export function Sidebar({ onCompose }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const { theme, setTheme } = useTheme();

  const { data: unreadData } = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: () => fetch("/api/notifications/unread").then((r) => r.json()),
    enabled: !!user,
  });
  const unreadCount: number = unreadData?.data?.count ?? 0;

  const unreadDmCount = useDmNotificationStore((s) => s.unreadCount);

  return (
    <nav className="flex flex-col h-full py-2 px-3 xl:px-5">
      {/* Logo */}
      <div className="mb-1">
        <Logo compact asLink className="xl:hidden" />
        <Logo asLink className="hidden xl:flex" />
      </div>

      {/* Nav items */}
      <div className="flex flex-col gap-1 flex-1">
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
          const isNotifications = href === "/notifications";
          const isMessages = href === "/messages";
          const badge = isNotifications ? unreadCount : isMessages ? unreadDmCount : 0;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-4 px-3 py-3 rounded-full hover:bg-[var(--hover)] transition-colors w-fit xl:w-full",
                isActive ? "font-bold text-[var(--foreground)]" : "text-[var(--muted)]"
              )}
            >
              <div className="relative">
                <Icon size={26} strokeWidth={isActive ? 2.5 : 2} />
                {badge > 0 && (
                  <span className="absolute -top-1 -right-1 bg-[var(--accent)] text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
              </div>
              <span className="hidden xl:block text-xl">{label}</span>
            </Link>
          );
        })}

      </div>

      {/* Compose button */}
      <button
        onClick={onCompose}
        className="mt-4 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-full p-3 xl:px-5 xl:py-3 flex items-center justify-center gap-2 font-bold transition-colors w-fit xl:w-full"
      >
        <PenSquare size={20} className="xl:hidden" />
        <span className="hidden xl:block">Post</span>
      </button>

      {/* User menu */}
      {user && (
        <div className="mt-4 group relative">
          <div className="flex items-center gap-3 p-3 rounded-full hover:bg-[var(--hover)] cursor-pointer transition-colors w-fit xl:w-full">
            <Avatar src={user.avatarUrl} alt={user.displayName} size="sm" />
            <div className="hidden xl:flex flex-col flex-1 min-w-0">
              <span className="font-bold text-sm truncate">{user.displayName}</span>
              <span className="text-[var(--muted)] text-sm truncate">@{user.username}</span>
            </div>
            <MoreHorizontal size={18} className="hidden xl:block text-[var(--muted)]" />
          </div>

          {/* Dropdown */}
          <div className="absolute bottom-full left-0 mb-1 w-56 bg-[var(--background)] border border-[var(--border)] rounded-2xl shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity overflow-hidden z-50">
            <Link
              href={`/${user.username}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--hover)] transition-colors border-b border-[var(--border)]"
            >
              <User size={18} />
              <span>View profile</span>
            </Link>
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--hover)] w-full text-left transition-colors border-b border-[var(--border)]"
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
              <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
            </button>
            <button
              onClick={logout}
              className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--hover)] w-full text-left transition-colors text-red-500"
            >
              <LogOut size={18} />
              <span>Log out @{user.username}</span>
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
