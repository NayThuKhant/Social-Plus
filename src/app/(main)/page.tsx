import { PostComposer } from "@/components/post/PostComposer";
import { HomeFeed } from "@/components/post/HomeFeed";
import { MobilePageHeader } from "@/components/layout/MobilePageHeader";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Home" };

export default function HomePage() {
  return (
    <div>
      <MobilePageHeader className="bg-[var(--background)]/80 backdrop-blur-md border-b border-[var(--border)] px-4 py-3">
        <h1 className="text-xl font-bold">Home</h1>
      </MobilePageHeader>
      <div className="border-b border-[var(--border)]">
        <PostComposer />
      </div>
      <HomeFeed />
    </div>
  );
}
