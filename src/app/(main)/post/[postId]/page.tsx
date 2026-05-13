"use client";

import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { PostCard } from "@/components/post/PostCard";
import { PostComposer } from "@/components/post/PostComposer";
import { PostFeed } from "@/components/post/PostFeed";
import { MobilePageHeader } from "@/components/layout/MobilePageHeader";
import { ArrowLeft, EyeOff } from "lucide-react";
import type { PostWithUser } from "@/types";

export default function PostDetailPage() {
  const { postId } = useParams<{ postId: string }>();
  const router = useRouter();

  const { data, isLoading } = useQuery<{ data: PostWithUser }>({
    queryKey: ["post", postId],
    queryFn: () => fetch(`/api/posts/${postId}`).then((r) => r.json()),
  });

  const post = data?.data;

  return (
    <div>
<MobilePageHeader className="bg-[var(--background)]/80 backdrop-blur-md border-b border-[var(--border)] px-4 py-3 flex items-center gap-6">
        <button onClick={() => router.back()} className="p-2 rounded-full hover:bg-[var(--hover)]">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold">Post</h1>
      </MobilePageHeader>

      {isLoading && (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!isLoading && !post && (
        <div className="flex flex-col items-center gap-3 py-20 px-6 text-center">
          <div className="w-16 h-16 rounded-full bg-[var(--hover)] flex items-center justify-center mb-2">
            <EyeOff size={28} className="text-[var(--muted)]" />
          </div>
          <h2 className="text-xl font-bold">This post isn&apos;t available</h2>
          <p className="text-[var(--muted)] max-w-xs">It may have been deleted, or you don&apos;t have permission to view it.</p>
        </div>
      )}

      {post && (
        <>
          {/* Ancestor chain */}
          {post.replyTo && (
            <PostCard post={post.replyTo as PostWithUser} showThread />
          )}
          <PostCard post={post} />
          <div className="border-b border-[var(--border)]">
            <PostComposer replyToId={postId} placeholder="Post your reply" />
          </div>
          <PostFeed
            queryKey={["replies", postId]}
            fetchUrl={`/api/posts/${postId}/replies`}
            emptyMessage="Be the first to reply!"
          />
        </>
      )}
    </div>
  );
}
