"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Play } from "lucide-react";
import { InfiniteScroll } from "@/components/shared/InfiniteScroll";
import type { PostWithUser, PaginatedResponse } from "@/types";

type Props = { username: string };

export function ProfileMediaGrid({ username }: Props) {
  const router = useRouter();
  const fetchUrl = `/api/users/${username}/posts?tab=media`;

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery<{ data: PaginatedResponse<PostWithUser> }>({
      queryKey: ["profile", username, "media"],
      queryFn: ({ pageParam }) => {
        const url = new URL(fetchUrl, window.location.origin);
        if (pageParam) url.searchParams.set("cursor", pageParam as string);
        return fetch(url.toString()).then((r) => r.json());
      },
      initialPageParam: null,
      getNextPageParam: (last) => last.data?.nextCursor ?? undefined,
    });

  const posts = data?.pages.flatMap((p) => p.data?.items || []) || [];

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!posts.length) {
    return <p className="text-center py-8 text-[var(--muted)]">No media yet.</p>;
  }

  // Flatten all media URLs across posts into individual tiles
  const tiles = posts.flatMap((post) =>
    (post.mediaUrls || []).map((url, i) => ({
      url,
      type: (post.mediaTypes || [])[i] || "image",
      postId: post.id,
    }))
  );

  return (
    <InfiniteScroll onLoadMore={fetchNextPage} hasMore={!!hasNextPage} isLoading={isFetchingNextPage}>
      <div className="grid grid-cols-3 gap-0.5">
        {tiles.map((tile, i) => {
          const isVideo = tile.type === "video" || /\.(mp4|mov|webm|ogg)(\?|$)/i.test(tile.url);
          return (
            <div
              key={i}
              className="relative aspect-square bg-[var(--border)] overflow-hidden cursor-pointer group"
              onClick={() => router.push(`/post/${tile.postId}`)}
            >
              {isVideo ? (
                <>
                  <video src={tile.url} className="w-full h-full object-cover" muted playsInline />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Play size={28} className="text-white drop-shadow-lg" fill="white" />
                  </div>
                </>
              ) : (
                <img src={tile.url} alt="" className="w-full h-full object-cover group-hover:opacity-90 transition-opacity" />
              )}
            </div>
          );
        })}
      </div>
    </InfiniteScroll>
  );
}
