"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/shared/Avatar";
import { VerifiedBadge } from "@/components/shared/VerifiedBadge";
import { useAuthStore } from "@/store/authStore";
import type { SafeUser, TrendingHashtag } from "@/types";

function SearchBar() {
  const [q, setQ] = useState("");
  const router = useRouter();

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim()) router.push(`/explore?q=${encodeURIComponent(q.trim())}`);
  }

  return (
    <form onSubmit={handleSearch} className="relative mb-4">
      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search"
        className="w-full pl-10 pr-4 py-3 rounded-full bg-[var(--hover)] border border-transparent focus:bg-transparent focus:border-[var(--accent)] outline-none transition-all text-sm"
      />
      <svg className="absolute left-3 top-3.5 text-[var(--muted)]" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>
    </form>
  );
}

function TrendingSection() {
  const { data } = useQuery<{ data: TrendingHashtag[] }>({
    queryKey: ["trending"],
    queryFn: () => fetch("/api/trending").then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  const trends = data?.data?.slice(0, 5) || [];

  return (
    <div className="bg-[var(--hover)] rounded-2xl overflow-hidden mb-4">
      <h2 className="font-bold text-xl px-4 py-3">Trends for you</h2>
      {trends.map((t) => (
        <Link
          key={t.tag}
          href={`/hashtag/${t.tag}`}
          className="block px-4 py-3 hover:bg-[var(--border)] transition-colors"
        >
          <p className="text-xs text-[var(--muted)]">Trending</p>
          <p className="font-bold">#{t.tag}</p>
          <p className="text-xs text-[var(--muted)]">{t.postsCount.toLocaleString()} posts</p>
        </Link>
      ))}
      <Link href="/explore" className="block px-4 py-3 text-[var(--accent)] hover:bg-[var(--border)] transition-colors text-sm">
        Show more
      </Link>
    </div>
  );
}

function WhoToFollow() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [followed, setFollowed] = useState<Set<string>>(new Set());

  const { data } = useQuery<{ data: SafeUser[] }>({
    queryKey: ["whoToFollow"],
    queryFn: () => fetch("/api/users/suggestions").then((r) => r.json()),
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
  });

  const { mutate: follow } = useMutation({
    mutationFn: (username: string) =>
      fetch(`/api/users/${username}/follow`, { method: "POST" }).then((r) => r.json()),
    onSuccess: (_, username) => {
      setFollowed((prev) => new Set([...prev, username]));
      queryClient.invalidateQueries({ queryKey: ["whoToFollow"] });
    },
  });

  const suggestions = (data?.data || []).filter((u) => !followed.has(u.username)).slice(0, 3);

  if (!suggestions.length) return null;

  return (
    <div className="bg-[var(--hover)] rounded-2xl overflow-hidden">
      <h2 className="font-bold text-xl px-4 py-3">Who to follow</h2>
      {suggestions.map((u) => (
        <div key={u.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--border)] transition-colors">
          <Avatar src={u.avatarUrl} alt={u.displayName} username={u.username} size="md" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <span className="font-bold text-sm truncate">{u.displayName}</span>
              {u.verified && <VerifiedBadge size={14} />}
            </div>
            <p className="text-[var(--muted)] text-sm">@{u.username}</p>
          </div>
          <button
            onClick={() => follow(u.username)}
            className="px-4 py-1.5 rounded-full border border-[var(--foreground)] font-bold text-sm hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-colors flex-shrink-0"
          >
            Follow
          </button>
        </div>
      ))}
      <Link href="/explore" className="block px-4 py-3 text-[var(--accent)] hover:bg-[var(--border)] transition-colors text-sm">
        Show more
      </Link>
    </div>
  );
}

export function RightSidebar() {
  return (
    <div className="px-4 py-2 sticky top-0 max-h-screen overflow-y-auto">
      <SearchBar />
      <TrendingSection />
      <WhoToFollow />
    </div>
  );
}
