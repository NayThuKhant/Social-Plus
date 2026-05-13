"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Link as LinkIcon, MapPin, Calendar, Lock } from "lucide-react";
import { Avatar } from "@/components/shared/Avatar";
import { VerifiedBadge } from "@/components/shared/VerifiedBadge";
import { PostFeed } from "@/components/post/PostFeed";
import { ProfileMediaGrid } from "@/components/post/ProfileMediaGrid";
import { useAuthStore } from "@/store/authStore";
import { MobilePageHeader } from "@/components/layout/MobilePageHeader";
import { useScrollStore } from "@/store/scrollStore";
import { formatCount } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import type { SafeUser } from "@/types";
import { useConfirm } from "@/components/shared/ConfirmDialog";

const tabs = ["Posts", "Replies", "Media", "Likes"] as const;

type ProfileUser = SafeUser & { isFollowing: boolean; isFollowedBy: boolean; isBlockedByMe: boolean; isBlockingMe: boolean };

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("Posts");
  const [editMode, setEditMode] = useState(false);
  const navVisible = useScrollStore((s) => s.navVisible);
  const confirm = useConfirm((s) => s.show);

  const { data, isLoading } = useQuery<{ data: ProfileUser }>({
    queryKey: ["profile", username],
    queryFn: () => fetch(`/api/users/${username}`).then((r) => r.json()),
  });

  const profile = data?.data;
  const isOwn = currentUser?.username === username;

  const { mutate: toggleFollow, isPending: followPending } = useMutation({
    mutationFn: () => fetch(`/api/users/${username}/follow`, { method: "POST" }).then((r) => r.json()),
    onMutate: () => {
      queryClient.setQueryData(["profile", username], (old: { data: ProfileUser } | undefined) => {
        if (!old?.data) return old;
        const nowFollowing = !old.data.isFollowing;
        return {
          ...old,
          data: {
            ...old.data,
            isFollowing: nowFollowing,
            followersCount: old.data.followersCount + (nowFollowing ? 1 : -1),
          },
        };
      });
    },
    onSuccess: (res) => {
      queryClient.setQueryData(["profile", username], (old: { data: ProfileUser } | undefined) => {
        if (!old?.data) return old;
        return { ...old, data: { ...old.data, isFollowing: res.following } };
      });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", username] });
      toast.error("Failed to update follow status");
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return <p className="text-center py-8 text-[var(--muted)]">User not found.</p>;
  }

  const tabParam = activeTab.toLowerCase();

  return (
    <div>
{/* Header */}
      <MobilePageHeader className="bg-[var(--background)]/80 backdrop-blur-md border-b border-[var(--border)] px-4 py-3 flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 rounded-full hover:bg-[var(--hover)]">
          <ArrowLeft size={20} />
        </button>
        <div>
          <div className="flex items-center gap-1">
            <h1 className="text-xl font-bold">{profile.displayName}</h1>
            {profile.verified && <VerifiedBadge size={18} />}
          </div>
          <p className="text-[var(--muted)] text-sm">{formatCount(profile.postsCount)} posts</p>
        </div>
      </MobilePageHeader>

      {/* Banner */}
      <div className="relative h-48 bg-[var(--border)]">
        {profile.bannerUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.bannerUrl} alt="Banner" className="w-full h-full object-cover" />
        )}
      </div>

      {/* Profile info */}
      <div className="px-4 pb-4">
        <div className="flex items-start justify-between -mt-12 mb-3 relative z-10">
          <div className="ring-4 ring-[var(--background)] rounded-full">
            <Avatar src={profile.avatarUrl} alt={profile.displayName} size="xl" />
          </div>
          <div className="flex gap-2 mt-14 items-center">
            {/* Copy profile link — always visible */}
            <button
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/${profile.username}`);
                toast.success("Link copied!");
              }}
              className="p-2 rounded-full border border-[var(--muted)]/30 hover:bg-[var(--hover)] transition-colors"
              title="Copy profile link"
            >
              <LinkIcon size={17} />
            </button>
            {isOwn ? (
              <Link
                href="/settings"
                className="px-4 py-1.5 rounded-full border border-[var(--muted)]/30 font-bold text-sm hover:bg-[var(--hover)] transition-colors"
              >
                Edit profile
              </Link>
            ) : (
              <>
                {/* Message — visible to anyone not blocked */}
                {!profile.isBlockedByMe && !profile.isBlockingMe && (
                  <button
                    onClick={async () => {
                      const res = await fetch(`/api/messages?recipientId=${profile.id}`);
                      const d = await res.json();
                      if (d.data?.id) {
                        router.push(`/messages/${d.data.id}`);
                      } else {
                        router.push(`/messages?dm=${profile.username}`);
                      }
                    }}
                    className="px-4 py-1.5 rounded-full border border-[var(--muted)]/30 font-bold text-sm hover:bg-[var(--hover)] transition-colors"
                  >
                    Message
                  </button>
                )}

                {/* Follow / Unfollow — hidden if either side has a block */}
                {!profile.isBlockingMe && !profile.isBlockedByMe && (
                  <button
                    onClick={() => toggleFollow()}
                    disabled={followPending}
                    className={`px-4 py-1.5 rounded-full font-bold text-sm transition-colors ${
                      profile.isFollowing
                        ? "border border-[var(--muted)]/30 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/50"
                        : "bg-[var(--foreground)] text-[var(--background)] hover:opacity-90"
                    } disabled:opacity-50`}
                  >
                    {profile.isFollowing ? "Following" : profile.isFollowedBy ? "Follow back" : "Follow"}
                  </button>
                )}

                {/* Block / Unblock — text pill, always visible on other profiles */}
                <button
                  onClick={async () => {
                    if (profile.isBlockedByMe) {
                      const ok = await confirm({ title: `Unblock @${profile.username}?`, message: "They will be able to see your posts and interact with you again.", confirmLabel: "Unblock" });
                      if (!ok) return;
                    } else {
                      const ok = await confirm({ title: `Block @${profile.username}?`, message: "They won't be able to interact with you.", confirmLabel: "Block", danger: true });
                      if (!ok) return;
                    }
                    const res = await fetch(`/api/users/${profile.username}/block`, { method: "POST" });
                    const d = await res.json();
                    queryClient.setQueryData(["profile", username], (old: { data: ProfileUser } | undefined) => {
                      if (!old?.data) return old;
                      return { ...old, data: { ...old.data, isBlockedByMe: d.data.blocked } };
                    });
                    toast.success(d.data.blocked ? "User blocked" : "User unblocked");
                  }}
                  className={`px-4 py-1.5 rounded-full border font-bold text-sm transition-colors ${
                    profile.isBlockedByMe
                      ? "border-red-500/50 text-red-500 hover:bg-red-500/10"
                      : "border-[var(--muted)]/30 text-[var(--muted)] hover:bg-[var(--hover)]"
                  }`}
                >
                  {profile.isBlockedByMe ? "Unblock" : "Block"}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 mb-1">
          <h2 className="text-xl font-bold">{profile.displayName}</h2>
          {profile.verified && <VerifiedBadge size={20} />}
        </div>
        <p className="text-[var(--muted)] mb-3">@{profile.username}</p>

        {profile.bio && <p className="mb-3 leading-relaxed">{profile.bio}</p>}

        <div className="flex flex-wrap gap-4 text-[var(--muted)] text-sm mb-3">
          {profile.location && (
            <span className="flex items-center gap-1"><MapPin size={14} /> {profile.location}</span>
          )}
          {profile.website && (
            <a href={profile.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[var(--accent)] hover:underline">
              <LinkIcon size={14} /> {profile.website.replace(/^https?:\/\//, "")}
            </a>
          )}
          <span className="flex items-center gap-1">
            <Calendar size={14} /> Joined {format(new Date(profile.createdAt), "MMMM yyyy")}
          </span>
        </div>

        <div className="flex gap-4 text-sm">
          <Link href={`/${username}/following`} className="hover:underline">
            <span className="font-bold">{formatCount(profile.followingCount)}</span>{" "}
            <span className="text-[var(--muted)]">Following</span>
          </Link>
          <Link href={`/${username}/followers`} className="hover:underline">
            <span className="font-bold">{formatCount(profile.followersCount)}</span>{" "}
            <span className="text-[var(--muted)]">Followers</span>
          </Link>
        </div>
      </div>

      {/* Blocked-by notice */}
      {profile.isBlockingMe && !profile.isBlockedByMe && (
        <div className="mx-4 my-3 px-4 py-3 rounded-xl bg-[var(--hover)] border border-[var(--border)] text-sm text-[var(--muted)] text-center">
          You can't follow or interact with this account.
        </div>
      )}

      {/* Blocked-by-me notice */}
      {profile.isBlockedByMe && (
        <div className="mx-4 my-3 px-4 py-3 rounded-xl bg-[var(--hover)] border border-[var(--border)] text-sm text-[var(--muted)] text-center">
          You've blocked this account. Unblock to see their posts.
        </div>
      )}

      {/* Private account gate — show lock when not following and not own profile */}
      {!profile.isBlockedByMe && !profile.isBlockingMe && profile.isPrivate && !isOwn && !profile.isFollowing && (
        <div className="flex flex-col items-center py-14 px-4 text-center">
          <div className="w-16 h-16 rounded-full bg-[var(--hover)] flex items-center justify-center mb-4">
            <Lock size={28} className="text-[var(--muted)]" />
          </div>
          <p className="font-bold text-lg">This account is private</p>
          <p className="text-[var(--muted)] text-sm mt-1">Follow this account to see their posts.</p>
        </div>
      )}

      {/* Tabs — hidden when blocked or private and not following */}
      {!profile.isBlockedByMe && !profile.isBlockingMe && (isOwn || !profile.isPrivate || profile.isFollowing) && (
        <>
          <div className={`flex border-b border-[var(--border)] sticky bg-[var(--background)] z-10 transition-[top] duration-300 ease-in-out lg:top-14 ${navVisible ? "top-14" : "top-0"}`}>
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`flex-1 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === t
                    ? "border-[var(--accent)] text-[var(--foreground)]"
                    : "border-transparent text-[var(--muted)] hover:bg-[var(--hover)]"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {activeTab === "Media" ? (
            <ProfileMediaGrid username={username} />
          ) : (
            <PostFeed
              queryKey={["profile", username, tabParam]}
              fetchUrl={`/api/users/${username}/posts?tab=${tabParam}`}
              emptyMessage={`No ${activeTab.toLowerCase()} yet.`}
            />
          )}
        </>
      )}
    </div>
  );
}
