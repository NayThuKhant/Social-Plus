"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { PostFeed } from "@/components/post/PostFeed";
import { useQuery } from "@tanstack/react-query";
import { Avatar } from "@/components/shared/Avatar";
import { VerifiedBadge } from "@/components/shared/VerifiedBadge";
import Link from "next/link";
import type { SafeUser, TrendingHashtag } from "@/types";
import { MobilePageHeader } from "@/components/layout/MobilePageHeader";

const tabs = ["For you", "Trending", "People"] as const;

export default function ExplorePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") || "";
  const [tab, setTab] = useState<(typeof tabs)[number]>("For you");
  const [searchInput, setSearchInput] = useState(q);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchInput.trim()) router.push(`/explore?q=${encodeURIComponent(searchInput.trim())}`);
  }

  const { data: searchData, isLoading: searching } = useQuery({
    queryKey: ["search", q],
    queryFn: () => fetch(`/api/search?q=${encodeURIComponent(q)}`).then((r) => r.json()),
    enabled: !!q,
  });

  const { data: trendingData } = useQuery<{ data: TrendingHashtag[] }>({
    queryKey: ["trending"],
    queryFn: () => fetch("/api/trending").then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div>
<MobilePageHeader className="bg-[var(--background)]/80 backdrop-blur-md px-4 py-3 border-b border-[var(--border)]">
        <form onSubmit={handleSearch} className="relative">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search"
            className="w-full pl-10 pr-4 py-2.5 rounded-full bg-[var(--hover)] border border-transparent focus:bg-transparent focus:border-[var(--accent)] outline-none transition-all"
          />
          <svg className="absolute left-3 top-3 text-[var(--muted)]" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
        </form>

        {!q && (
          <div className="flex mt-3 -mx-4">
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-3 font-medium text-sm border-b-2 transition-colors ${tab === t ? "border-[var(--accent)] text-[var(--foreground)]" : "border-transparent text-[var(--muted)] hover:bg-[var(--hover)]"}`}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </MobilePageHeader>

      {q ? (
        <div>
          {/* Search results */}
          {searching && <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" /></div>}
          {searchData?.data?.users?.length > 0 && (
            <div className="border-b border-[var(--border)] pb-4">
              <h3 className="px-4 py-3 font-bold">People</h3>
              {searchData.data.users.map((u: SafeUser) => (
                <Link key={u.id} href={`/${u.username}`} className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--hover)] transition-colors">
                  <Avatar src={u.avatarUrl} alt={u.displayName} size="md" />
                  <div>
                    <div className="flex items-center gap-1 font-bold">{u.displayName} {u.verified && <VerifiedBadge size={14} />}</div>
                    <p className="text-[var(--muted)] text-sm">@{u.username}</p>
                    {u.bio && <p className="text-sm mt-0.5 line-clamp-1">{u.bio}</p>}
                  </div>
                </Link>
              ))}
            </div>
          )}
          {(searchData?.data?.items || searchData?.data?.users) && (
            <div>
              <h3 className="px-4 py-3 font-bold border-b border-[var(--border)]">Posts</h3>
              <PostFeed queryKey={["search", "posts", q]} fetchUrl={`/api/search?type=posts&q=${encodeURIComponent(q)}`} emptyMessage="No posts found." />
            </div>
          )}
        </div>
      ) : (
        <div>
          {tab === "For you" && (
            <PostFeed queryKey={["feed", "explore"]} fetchUrl="/api/feed/explore" emptyMessage="No trending posts right now." />
          )}
          {tab === "Trending" && (
            <div>
              {trendingData?.data?.map((t) => (
                <Link key={t.tag} href={`/hashtag/${t.tag}`} className="block px-4 py-4 hover:bg-[var(--hover)] border-b border-[var(--border)] transition-colors">
                  <p className="text-xs text-[var(--muted)]">Trending</p>
                  <p className="font-bold text-lg">#{t.tag}</p>
                  <p className="text-[var(--muted)] text-sm">{t.postsCount.toLocaleString()} posts</p>
                </Link>
              ))}
            </div>
          )}
          {tab === "People" && (
            <div className="px-4 py-4 text-center text-[var(--muted)]">
              Search for people to follow
            </div>
          )}
        </div>
      )}
    </div>
  );
}
