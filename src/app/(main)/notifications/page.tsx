"use client";

import { useState, useEffect } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { InfiniteScroll } from "@/components/shared/InfiniteScroll";
import { Avatar } from "@/components/shared/Avatar";
import { VerifiedBadge } from "@/components/shared/VerifiedBadge";
import { Heart, Repeat2, UserPlus, MessageCircle, AtSign, Quote } from "lucide-react";
import Link from "next/link";
import { formatRelativeTime } from "@/lib/utils";
import type { NotificationWithActor, PaginatedResponse } from "@/types";
import { MobilePageHeader } from "@/components/layout/MobilePageHeader";

const iconMap = {
  LIKE:    { Icon: Heart,          color: "text-rose-500",    bg: "bg-rose-500" },
  REPOST:  { Icon: Repeat2,        color: "text-green-500",   bg: "bg-green-500" },
  FOLLOW:  { Icon: UserPlus,       color: "text-[var(--accent)]", bg: "bg-[var(--accent)]" },
  REPLY:   { Icon: MessageCircle,  color: "text-[var(--accent)]", bg: "bg-[var(--accent)]" },
  MENTION: { Icon: AtSign,         color: "text-[var(--accent)]", bg: "bg-[var(--accent)]" },
  QUOTE:   { Icon: Quote,          color: "text-purple-500",  bg: "bg-purple-500" },
};

const labelMap: Record<string, string> = {
  LIKE:    "liked your post",
  REPOST:  "reposted your post",
  FOLLOW:  "followed you",
  REPLY:   "replied to your post",
  MENTION: "mentioned you",
  QUOTE:   "quoted your post",
};

const TABS = ["All", "Mentions"] as const;
type Tab = (typeof TABS)[number];

export default function NotificationsPage() {
  const [tab, setTab] = useState<Tab>("All");
  const queryClient = useQueryClient();

  // Reset badge as soon as the page is visited
  useEffect(() => {
    queryClient.setQueryData(["notifications", "unread"], { data: { count: 0 } });
  }, [queryClient]);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery<{ data: PaginatedResponse<NotificationWithActor> }>({
      queryKey: ["notifications", tab],
      queryFn: ({ pageParam }) => {
        const url = new URL("/api/notifications", window.location.origin);
        if (pageParam) url.searchParams.set("cursor", pageParam as string);
        if (tab === "Mentions") url.searchParams.set("type", "MENTION");
        return fetch(url.toString()).then((r) => r.json());
      },
      initialPageParam: null,
      getNextPageParam: (last) => last.data?.nextCursor ?? undefined,
    });

  const notifications = data?.pages.flatMap((p) => p.data?.items || []) || [];

  return (
    <div>
{/* Header */}
      <MobilePageHeader className="bg-[var(--background)]/80 backdrop-blur-md border-b border-[var(--border)]">
        <div className="px-4 py-3">
          <h1 className="text-xl font-bold">Notifications</h1>
        </div>
        <div className="flex">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3 text-sm font-medium transition-colors relative hover:bg-[var(--hover)] ${
                tab === t ? "text-[var(--foreground)]" : "text-[var(--muted)]"
              }`}
            >
              {t}
              {tab === t && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-[var(--accent)] rounded-full" />
              )}
            </button>
          ))}
        </div>
      </MobilePageHeader>

      {isLoading && (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      <InfiniteScroll onLoadMore={fetchNextPage} hasMore={!!hasNextPage} isLoading={isFetchingNextPage}>
        {notifications.map((n) => {
          const { Icon, color, bg } = iconMap[n.type as keyof typeof iconMap] || iconMap.LIKE;
          const label = labelMap[n.type] || "";
          const href = n.post ? `/post/${n.post.id}` : `/${n.actor.username}`;

          return (
            <Link
              key={n.id}
              href={href}
              className={`flex gap-3 px-4 py-3 border-b border-[var(--border)] hover:bg-[var(--hover)] transition-colors ${
                !n.isRead ? "bg-[var(--accent)]/[0.04]" : ""
              }`}
            >
              {/* Avatar + icon badge */}
              <div className="relative flex-shrink-0 self-start mt-0.5">
                <Avatar
                  src={n.actor.avatarUrl}
                  alt={n.actor.displayName}
                  size="md"
                />
                <span className={`absolute -bottom-1 -right-1 flex items-center justify-center w-5 h-5 rounded-full ${bg} ring-2 ring-[var(--background)]`}>
                  <Icon size={11} className="text-white" />
                </span>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm leading-snug">
                    <span className="font-bold">{n.actor.displayName}</span>
                    {n.actor.verified && <VerifiedBadge size={13} />}
                    <span className="text-[var(--muted)]"> {label}</span>
                  </p>
                  <span className="text-[var(--muted)] text-xs flex-shrink-0 mt-0.5">
                    {formatRelativeTime(n.createdAt)}
                  </span>
                </div>
                {n.post?.content && (
                  <p className="mt-1.5 text-[var(--muted)] text-sm line-clamp-2 border border-[var(--border)] rounded-xl px-3 py-2">
                    {n.post.content}
                  </p>
                )}
              </div>
            </Link>
          );
        })}

        {!isLoading && notifications.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full bg-[var(--hover)] flex items-center justify-center mx-auto mb-4">
              <MessageCircle size={28} className="text-[var(--muted)]" />
            </div>
            <p className="font-bold text-xl mb-1">Nothing to see here</p>
            <p className="text-[var(--muted)] text-sm">You have no notifications yet.</p>
          </div>
        )}
      </InfiniteScroll>
    </div>
  );
}
