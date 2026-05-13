"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { PostCard } from "./PostCard";
import { InfiniteScroll } from "@/components/shared/InfiniteScroll";
import type { PostWithUser, PaginatedResponse } from "@/types";

type PostFeedProps = {
  queryKey: string[];
  fetchUrl: string;
  emptyMessage?: string;
};

export function PostFeed({ queryKey, fetchUrl, emptyMessage = "No posts yet." }: PostFeedProps) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError } =
    useInfiniteQuery<{ data: PaginatedResponse<PostWithUser> }>({
      queryKey,
      queryFn: ({ pageParam }) => {
        const url = new URL(fetchUrl, window.location.origin);
        if (pageParam) url.searchParams.set("cursor", pageParam as string);
        return fetch(url.toString()).then((r) => r.json());
      },
      initialPageParam: null,
      getNextPageParam: (last) => last.data?.nextCursor ?? undefined,
    });

  const seen = new Set<string>();
  const posts = (data?.pages.flatMap((p) => p.data?.items || []) || []).filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isError) {
    return <p className="text-center py-8 text-[var(--muted)]">Failed to load posts.</p>;
  }

  if (!posts.length) {
    return <p className="text-center py-8 text-[var(--muted)]">{emptyMessage}</p>;
  }

  return (
    <InfiniteScroll
      onLoadMore={fetchNextPage}
      hasMore={!!hasNextPage}
      isLoading={isFetchingNextPage}
    >
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </InfiniteScroll>
  );
}
