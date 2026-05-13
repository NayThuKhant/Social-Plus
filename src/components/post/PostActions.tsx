"use client";

import { Heart, MessageCircle, Repeat2, Bookmark, Share, BarChart2, Quote, Send, Link as LinkIcon } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn, formatCount } from "@/lib/utils";
import type { PostWithUser, SafeUser } from "@/types";
import { useAuthStore } from "@/store/authStore";
import { useQueryClient } from "@tanstack/react-query";
import { UserPickerSheet } from "@/components/messages/UserPickerSheet";

type PostActionsProps = {
  post: PostWithUser;
  onReplyClick?: () => void;
  onQuoteClick?: () => void;
  compact?: boolean;
};

export function PostActions({ post, onReplyClick, onQuoteClick, compact }: PostActionsProps) {
  const { user } = useAuthStore();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [liked, setLiked] = useState(!!post.isLiked);
  const [likeCount, setLikeCount] = useState(post.likesCount);
  const [reposted, setReposted] = useState(!!post.isReposted);
  const [repostCount, setRepostCount] = useState(post.repostsCount);
  const [bookmarked, setBookmarked] = useState(!!post.isBookmarked);
  const [repostOpen, setRepostOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [showDmPicker, setShowDmPicker] = useState(false);
  const [dmLoadingId, setDmLoadingId] = useState<string | null>(null);
  const repostRef = useRef<HTMLDivElement>(null);
  const shareRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (repostRef.current && !repostRef.current.contains(e.target as Node)) setRepostOpen(false);
      if (shareRef.current && !shareRef.current.contains(e.target as Node)) setShareOpen(false);
    }
    if (repostOpen || shareOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [repostOpen, shareOpen]);

  async function handleLike() {
    if (!user) return router.push("/login");
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikeCount((c) => c + (wasLiked ? -1 : 1));
    try {
      await fetch(`/api/posts/${post.id}/like`, { method: "POST" });
      const patch = (old: { data: { isLiked: boolean; likesCount: number } } | undefined) => {
        if (!old?.data) return old;
        return { ...old, data: { ...old.data, isLiked: !wasLiked, likesCount: old.data.likesCount + (wasLiked ? -1 : 1) } };
      };
      queryClient.setQueryData(["post", post.id], patch);
    } catch {
      setLiked(wasLiked);
      setLikeCount((c) => c + (wasLiked ? 1 : -1));
    }
  }

  async function handleRepost() {
    if (!user) return router.push("/login");
    setReposted(!reposted);
    setRepostCount((c) => c + (reposted ? -1 : 1));
    try {
      await fetch(`/api/posts/${post.id}/repost`, { method: "POST" });
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    } catch {
      setReposted(reposted);
      setRepostCount((c) => c + (reposted ? 1 : -1));
    }
  }

  async function handleBookmark() {
    if (!user) return router.push("/login");
    setBookmarked(!bookmarked);
    try {
      await fetch(`/api/posts/${post.id}/bookmark`, { method: "POST" });
      queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
      toast.success(bookmarked ? "Removed from bookmarks" : "Saved to bookmarks");
    } catch {
      setBookmarked(bookmarked);
    }
  }

  async function handleCopyLink() {
    const url = `${window.location.origin}/post/${post.id}`;
    await navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard");
    setShareOpen(false);
  }

  async function handleDmShare(recipient: SafeUser | null, existingConvId: string | null, displayName?: string) {
    if (!user) return;
    const name = recipient?.displayName ?? displayName ?? "Group";
    setDmLoadingId(existingConvId ?? recipient?.id ?? "");
    const postUrl = `${window.location.origin}/post/${post.id}`;
    try {
      if (!existingConvId && recipient) {
        // New 1:1 conversation — create it (may become a request)
        const res = await fetch("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recipientId: recipient.id, message: postUrl }),
        });
        if (!res.ok) { toast.error("Couldn't send message"); return; }
      } else if (existingConvId) {
        // Existing conversation (1:1 or group) — try sending; if 403 (received request), accept first
        let res = await fetch(`/api/messages/${existingConvId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: postUrl }),
        });
        if (res.status === 403) {
          await fetch(`/api/messages/${existingConvId}/accept`, { method: "POST" });
          res = await fetch(`/api/messages/${existingConvId}/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: postUrl }),
          });
        }
        if (!res.ok) { toast.error("Couldn't send message"); return; }
      }
      setShowDmPicker(false);
      toast.success(`Sent to ${name}`);
    } catch {
      toast.error("Failed to send");
    } finally {
      setDmLoadingId(null);
    }
  }

  const btnBase = "flex items-center gap-1.5 group transition-colors";
  const iconBase = "p-2 rounded-full transition-colors";

  return (
    <>
      <div className={cn("flex items-center justify-between text-[var(--muted)] -ml-2", compact && "justify-start gap-4")}>
        {/* Reply */}
        <button onClick={onReplyClick} className={cn(btnBase, "hover:text-[var(--accent)]")}>
          <span className={cn(iconBase, "group-hover:bg-blue-500/10")}>
            <MessageCircle size={compact ? 16 : 18} />
          </span>
          {!compact && <span className="text-sm">{formatCount(post.repliesCount)}</span>}
        </button>

        {/* Repost */}
        <div className="relative" ref={repostRef}>
          <button
            onClick={() => setRepostOpen((v) => !v)}
            className={cn(btnBase, reposted ? "text-[var(--success)]" : "hover:text-[var(--success)]")}
          >
            <span className={cn(iconBase, "group-hover:bg-green-500/10")}>
              <Repeat2 size={compact ? 16 : 18} />
            </span>
            {!compact && <span className="text-sm">{formatCount(repostCount)}</span>}
          </button>
          {repostOpen && (
            <div className="absolute bottom-full left-0 mb-1 bg-[var(--background)] border border-[var(--border)] rounded-2xl shadow-xl z-20 overflow-hidden min-w-[180px]">
              <button
                onClick={() => { handleRepost(); setRepostOpen(false); }}
                className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--hover)] w-full text-sm font-medium text-[var(--foreground)]"
              >
                <Repeat2 size={18} />
                {reposted ? "Undo repost" : "Repost"}
              </button>
              {onQuoteClick && (
                <button
                  onClick={() => { onQuoteClick(); setRepostOpen(false); }}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--hover)] w-full text-sm font-medium text-[var(--foreground)]"
                >
                  <Quote size={18} />
                  Quote
                </button>
              )}
            </div>
          )}
        </div>

        {/* Like */}
        <button onClick={handleLike} className={cn(btnBase, liked ? "text-[var(--danger)]" : "hover:text-[var(--danger)]")}>
          <span className={cn(iconBase, "group-hover:bg-red-500/10")}>
            <Heart size={compact ? 16 : 18} fill={liked ? "currentColor" : "none"} />
          </span>
          {!compact && <span className="text-sm">{formatCount(likeCount)}</span>}
        </button>

        {/* Views */}
        {!compact && (
          <div className="flex items-center gap-1.5">
            <span className={iconBase}><BarChart2 size={18} /></span>
            <span className="text-sm">{formatCount(post.viewsCount)}</span>
          </div>
        )}

        <div className="flex items-center gap-1">
          {/* Bookmark */}
          <button onClick={handleBookmark} className={cn(btnBase, bookmarked ? "text-[var(--accent)]" : "hover:text-[var(--accent)]")}>
            <span className={cn(iconBase, "group-hover:bg-blue-500/10")}>
              <Bookmark size={compact ? 16 : 18} fill={bookmarked ? "currentColor" : "none"} />
            </span>
          </button>

          {/* Share dropdown */}
          <div className="relative" ref={shareRef}>
            <button
              onClick={(e) => { e.stopPropagation(); setShareOpen((v) => !v); }}
              className={cn(btnBase, "hover:text-[var(--accent)]")}
            >
              <span className={cn(iconBase, "group-hover:bg-blue-500/10")}>
                <Share size={compact ? 16 : 18} />
              </span>
            </button>
            {shareOpen && (
              <div className="absolute bottom-full right-0 mb-1 bg-[var(--background)] border border-[var(--border)] rounded-2xl shadow-xl z-20 overflow-hidden min-w-[180px]">
                <button
                  onClick={(e) => { e.stopPropagation(); handleCopyLink(); }}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--hover)] w-full text-sm font-medium text-[var(--foreground)]"
                >
                  <LinkIcon size={17} />
                  Copy link
                </button>
                {user && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setShareOpen(false); setShowDmPicker(true); }}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--hover)] w-full text-sm font-medium text-[var(--foreground)]"
                  >
                    <Send size={17} />
                    Share post to
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showDmPicker && (
        <UserPickerSheet
          title="Share post to"
          onClose={() => setShowDmPicker(false)}
          onSelect={handleDmShare}
          loadingId={dmLoadingId}
        />
      )}
    </>
  );
}
