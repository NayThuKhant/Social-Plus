"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Repeat2, MoreHorizontal, Trash2, Pin, PinOff } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import { Avatar } from "@/components/shared/Avatar";
import { VerifiedBadge } from "@/components/shared/VerifiedBadge";
import { MediaGrid } from "./MediaGrid";
import { PostActions } from "./PostActions";
import { PollDisplay } from "./PollDisplay";
import { useAuthStore } from "@/store/authStore";
import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import type { PostWithUser } from "@/types";
import { PostComposerModal } from "./PostComposerModal";
import { useConfirm } from "@/components/shared/ConfirmDialog";

type PostCardProps = {
  post: PostWithUser;
  showThread?: boolean;
};

function QuotedPost({ post }: { post: PostWithUser }) {
  return (
    <Link
      href={`/post/${post.id}`}
      className="block mt-3 border border-[var(--border)] rounded-xl p-3 hover:bg-[var(--hover)] transition-colors"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 mb-1">
        <Avatar src={post.user.avatarUrl} alt={post.user.displayName} size="xs" />
        <span className="font-bold text-sm">{post.user.displayName}</span>
        {post.user.verified && <VerifiedBadge size={12} />}
        <span className="text-[var(--muted)] text-sm">@{post.user.username}</span>
      </div>
      {post.content && <p className="text-sm">{renderContent(post.content)}</p>}
      {post.mediaUrls.length > 0 && (
        <MediaGrid urls={post.mediaUrls.slice(0, 1)} types={post.mediaTypes.slice(0, 1)} />
      )}
    </Link>
  );
}

export function PostCard({ post, showThread }: PostCardProps) {
  const isRepost = !!post.repostOf;
  const displayPost = isRepost ? (post.repostOf as PostWithUser) : post;

  const { user } = useAuthStore();
  const router = useRouter();
  const queryClient = useQueryClient();
  const confirm = useConfirm((s) => s.show);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [pinned, setPinned] = useState(!!displayPost.isPinned);

  if (deleted) return null;

  const isOwner = user?.id === displayPost.user.id;

  async function handleDelete() {
    const ok = await confirm({ title: "Delete post?", message: "This cannot be undone.", confirmLabel: "Delete", danger: true });
    if (!ok) return;
    const res = await fetch(`/api/posts/${displayPost.id}`, { method: "DELETE" });
    if (res.ok) {
      setDeleted(true);
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Post deleted");
    }
    setMenuOpen(false);
  }

  function handlePostClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.closest("a") || target.closest("button")) return;
    router.push(`/post/${displayPost.id}`);
  }

  return (
    <article
      className="px-4 py-3 border-b border-[var(--border)] hover:bg-[var(--hover)] transition-colors cursor-pointer relative"
      onClick={handlePostClick}
    >
      {isRepost && (
        <div className="flex items-center gap-2 text-[var(--muted)] text-xs mb-2 ml-10">
          <Repeat2 size={14} />
          <span>{post.user.displayName} reposted</span>
        </div>
      )}

      {displayPost.isPinned && (
        <div className="flex items-center gap-2 text-[var(--muted)] text-xs mb-2 ml-10">
          <Pin size={14} />
          <span>Pinned post</span>
        </div>
      )}

      <div className="flex gap-3">
        <div className="flex flex-col items-center">
          <Avatar
            src={displayPost.user.avatarUrl}
            alt={displayPost.user.displayName}
            username={displayPost.user.username}
            size="md"
          />
          {showThread && <div className="w-0.5 bg-[var(--border)] flex-1 mt-1" />}
        </div>

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 min-w-0 flex-wrap">
              <Link
                href={`/${displayPost.user.username}`}
                className="font-bold hover:underline truncate"
                onClick={(e) => e.stopPropagation()}
              >
                {displayPost.user.displayName}
              </Link>
              {displayPost.user.verified && <VerifiedBadge size={16} />}
              <span className="text-[var(--muted)] text-sm truncate">
                @{displayPost.user.username} · {formatRelativeTime(displayPost.createdAt)}
              </span>
            </div>

            {/* Options menu */}
            {isOwner && (
              <div className="relative flex-shrink-0">
                <button
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
                  className="p-1 rounded-full hover:bg-blue-500/10 hover:text-[var(--accent)] transition-colors text-[var(--muted)]"
                >
                  <MoreHorizontal size={18} />
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-8 bg-[var(--background)] border border-[var(--border)] rounded-xl shadow-lg z-10 overflow-hidden min-w-[160px]">
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        const res = await fetch(`/api/posts/${displayPost.id}/pin`, { method: "POST" });
                        if (res.ok) { const d = await res.json(); setPinned(d.data.isPinned); }
                        setMenuOpen(false);
                      }}
                      className="flex items-center gap-2 px-4 py-3 hover:bg-[var(--hover)] w-full text-sm"
                    >
                      {pinned ? <PinOff size={16} /> : <Pin size={16} />}
                      {pinned ? "Unpin from profile" : "Pin to profile"}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                      className="flex items-center gap-2 px-4 py-3 hover:bg-[var(--hover)] text-[var(--danger)] w-full text-sm"
                    >
                      <Trash2 size={16} />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Reply indicator */}
          {displayPost.replyTo && (
            <p className="text-[var(--muted)] text-sm mb-1">
              Replying to{" "}
              <Link href={`/${displayPost.replyTo.user.username}`} className="text-[var(--accent)]" onClick={(e) => e.stopPropagation()}>
                @{displayPost.replyTo.user.username}
              </Link>
            </p>
          )}

          {/* Content */}
          {displayPost.content && (
            <p className="mt-0.5 whitespace-pre-wrap break-words leading-relaxed">
              {renderContent(displayPost.content)}
            </p>
          )}

          {/* Media */}
          {displayPost.mediaUrls.length > 0 && (
            <div onClick={(e) => e.stopPropagation()}>
              <MediaGrid urls={displayPost.mediaUrls} types={displayPost.mediaTypes} />
            </div>
          )}

          {/* Poll */}
          {displayPost.poll && (
            <div onClick={(e) => e.stopPropagation()}>
              <PollDisplay poll={displayPost.poll} postId={displayPost.id} />
            </div>
          )}

          {/* Quote post */}
          {displayPost.quoteOf && (
            <QuotedPost post={displayPost.quoteOf as PostWithUser} />
          )}

          {/* Actions */}
          <div className="mt-2" onClick={(e) => e.stopPropagation()}>
            <PostActions
              post={displayPost}
              onReplyClick={() => router.push(`/post/${displayPost.id}`)}
              onQuoteClick={() => setQuoteOpen(true)}
            />
          </div>
        </div>
      </div>
      {quoteOpen && (
        <PostComposerModal quoteOfId={displayPost.id} onClose={() => setQuoteOpen(false)} />
      )}
    </article>
  );
}

function renderContent(text: string) {
  const parts = text.split(/(https?:\/\/[^\s<>"]+|[@#][\w]+)/g);
  return parts.map((part, i) => {
    if (part.startsWith("http://") || part.startsWith("https://")) {
      return (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline break-all" onClick={(e) => e.stopPropagation()}>
          {part}
        </a>
      );
    }
    if (part.startsWith("#")) {
      return (
        <Link key={i} href={`/hashtag/${part.slice(1)}`} className="text-[var(--accent)] hover:underline" onClick={(e) => e.stopPropagation()}>
          {part}
        </Link>
      );
    }
    if (part.startsWith("@")) {
      return (
        <Link key={i} href={`/${part.slice(1)}`} className="text-[var(--accent)] hover:underline" onClick={(e) => e.stopPropagation()}>
          {part}
        </Link>
      );
    }
    return part;
  });
}
