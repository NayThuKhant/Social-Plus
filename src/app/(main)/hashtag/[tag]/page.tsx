"use client";

import { useParams, useRouter } from "next/navigation";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { PostCard } from "@/components/post/PostCard";
import { InfiniteScroll } from "@/components/shared/InfiniteScroll";
import { formatCount } from "@/lib/utils";
import type { PostWithUser } from "@/types";

type HashtagMeta = { id: string; tag: string; postsCount: number };
type PageData = { data: { hashtag: HashtagMeta | null; items: PostWithUser[]; nextCursor: string | null; hasMore: boolean } };

export default function HashtagPage() {
  const { tag } = useParams<{ tag: string }>();
  const router = useRouter();

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery<PageData>({
      queryKey: ["hashtag", tag],
      queryFn: ({ pageParam }) => {
        const url = new URL(`/api/hashtags/${tag}`, window.location.origin);
        if (pageParam) url.searchParams.set("cursor", pageParam as string);
        return fetch(url.toString()).then((r) => r.json());
      },
      initialPageParam: null,
      getNextPageParam: (last) => last.data?.nextCursor ?? undefined,
    });

  const hashtag = data?.pages[0]?.data?.hashtag;
  const posts = data?.pages.flatMap((p) => p.data?.items || []) || [];

  return (
    <div>
{/* Header */}
      <div className="sticky top-0 bg-[var(--background)]/80 backdrop-blur-md border-b border-[var(--border)] px-4 py-3 z-10 flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 rounded-full hover:bg-[var(--hover)]">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-bold">#{tag}</h1>
          {hashtag && (
            <p className="text-[var(--muted)] text-sm">{formatCount(hashtag.postsCount)} posts</p>
          )}
        </div>
      </div>

      {isLoading && (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!isLoading && posts.length === 0 && (
        <p className="text-center py-12 text-[var(--muted)]">No posts for #{tag} yet.</p>
      )}

      {posts.length > 0 && (
        <InfiniteScroll onLoadMore={fetchNextPage} hasMore={!!hasNextPage} isLoading={isFetchingNextPage}>
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </InfiniteScroll>
      )}
    </div>
  );
}
