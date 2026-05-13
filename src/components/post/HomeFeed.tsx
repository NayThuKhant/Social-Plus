"use client";

import { useState } from "react";
import { PostFeed } from "./PostFeed";

const TABS = [
  { id: "foryou", label: "For You" },
  { id: "following", label: "Following" },
] as const;

type Tab = (typeof TABS)[number]["id"];

export function HomeFeed() {
  const [tab, setTab] = useState<Tab>("foryou");

  return (
    <div>
      <div className="flex border-b border-[var(--border)] sticky top-0 lg:top-14 z-10 bg-[var(--background)]/80 backdrop-blur-md">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-3.5 text-sm font-semibold border-b-2 transition-colors ${
              tab === t.id
                ? "border-[var(--accent)] text-[var(--foreground)]"
                : "border-transparent text-[var(--muted)] hover:bg-[var(--hover)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <PostFeed
        key={tab}
        queryKey={["feed", tab]}
        fetchUrl={`/api/feed/home?tab=${tab}`}
        emptyMessage={
          tab === "following"
            ? "Follow some people to see their posts here!"
            : "No posts yet — come back soon!"
        }
      />
    </div>
  );
}
