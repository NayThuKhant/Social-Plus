import { PostFeed } from "@/components/post/PostFeed";
import { MobilePageHeader } from "@/components/layout/MobilePageHeader";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Bookmarks" };

export default function BookmarksPage() {
  return (
    <div>
      <MobilePageHeader className="bg-[var(--background)]/80 backdrop-blur-md border-b border-[var(--border)] px-4 py-3">
        <h1 className="text-xl font-bold">Bookmarks</h1>
      </MobilePageHeader>
      <PostFeed
        queryKey={["bookmarks"]}
        fetchUrl="/api/bookmarks"
        emptyMessage="Save posts to find them later. Bookmark posts you want to come back to."
      />
    </div>
  );
}
