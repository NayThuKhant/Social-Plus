"use client";

import { useParams, useRouter } from "next/navigation";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Avatar } from "@/components/shared/Avatar";
import { VerifiedBadge } from "@/components/shared/VerifiedBadge";
import Link from "next/link";
import { InfiniteScroll } from "@/components/shared/InfiniteScroll";
import type { SafeUser } from "@/types";

export default function FollowersPage() {
  const { username } = useParams<{ username: string }>();
  const router = useRouter();

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery<{ data: { items: SafeUser[]; nextCursor: string | null } }>({
      queryKey: ["followers", username],
      queryFn: ({ pageParam }) => {
        const url = new URL(`/api/users/${username}/followers`, window.location.origin);
        if (pageParam) url.searchParams.set("cursor", pageParam as string);
        return fetch(url.toString()).then((r) => r.json());
      },
      initialPageParam: null,
      getNextPageParam: (last) => last.data?.nextCursor ?? undefined,
    });

  const followers = data?.pages.flatMap((p) => p.data?.items || []) || [];

  return (
    <div>
<div className="sticky top-0 bg-[var(--background)]/80 backdrop-blur-md border-b border-[var(--border)] px-4 py-3 z-10 flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 rounded-full hover:bg-[var(--hover)]">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-bold">Followers</h1>
          <p className="text-[var(--muted)] text-sm">@{username}</p>
        </div>
      </div>

      {isLoading && <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" /></div>}

      <InfiniteScroll onLoadMore={fetchNextPage} hasMore={!!hasNextPage} isLoading={isFetchingNextPage}>
        {followers.map((u) => (
          <Link key={u.id} href={`/${u.username}`} className="flex items-center gap-3 px-4 py-4 border-b border-[var(--border)] hover:bg-[var(--hover)] transition-colors">
            <Avatar src={u.avatarUrl} alt={u.displayName} size="md" />
            <div className="flex-1">
              <div className="flex items-center gap-1 font-bold">{u.displayName} {u.verified && <VerifiedBadge size={14} />}</div>
              <p className="text-[var(--muted)] text-sm">@{u.username}</p>
              {u.bio && <p className="text-sm mt-0.5 line-clamp-1 text-[var(--muted)]">{u.bio}</p>}
            </div>
          </Link>
        ))}
      </InfiniteScroll>
    </div>
  );
}
