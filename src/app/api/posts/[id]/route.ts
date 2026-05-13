import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Per-process deduplication: "userId:postId" or "ip:postId"
const viewedSet = new Set<string>();

const postInclude = (viewerId?: string) => ({
  user: true,
  poll: {
    include: {
      options: {
        include: { votes: viewerId ? { where: { userId: viewerId } } : false },
      },
    },
  },
  replyTo: { include: { user: true } },
  quoteOf: { include: { user: true } },
  ...(viewerId
    ? {
        likes: { where: { userId: viewerId } },
        repostedBy: { where: { userId: viewerId } },
        bookmarks: { where: { userId: viewerId } },
      }
    : {}),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();

  const post = await prisma.post.findUnique({
    where: { id, isDeleted: false },
    include: postInclude(user?.id),
  });

  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Hide post if a block relationship exists between viewer and author
  if (post.userId !== user?.id) {
    if (user) {
      const block = await prisma.block.findFirst({
        where: {
          OR: [
            { blockerId: user.id, blockedId: post.userId },
            { blockerId: post.userId, blockedId: user.id },
          ],
        },
      });
      if (block) return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Hide posts from private accounts for non-followers (treat like blocked)
    if (post.user.isPrivate) {
      if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const follows = await prisma.follow.findUnique({
        where: { followerId_followingId: { followerId: user.id, followingId: post.userId } },
      });
      if (!follows) return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  // Deduplicate views per user (or IP for anonymous)
  const viewerKey = user
    ? `u:${user.id}:${id}`
    : `ip:${req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "anon"}:${id}`;
  const isNewView = !viewedSet.has(viewerKey);
  if (isNewView) {
    viewedSet.add(viewerKey);
    prisma.post.update({ where: { id }, data: { viewsCount: { increment: 1 } } }).catch(() => {});
  }

  const pollOptions = post.poll?.options as Array<{ id: string; votes: unknown[] }> | undefined;
  const userVoteId = pollOptions?.find((o) => (o.votes as unknown[]).length > 0)?.id ?? null;

  const enriched = {
    ...post,
    viewsCount: post.viewsCount + (isNewView ? 1 : 0),
    isLiked: user ? post.likes?.length > 0 : false,
    isReposted: user ? post.repostedBy?.length > 0 : false,
    isBookmarked: user ? post.bookmarks?.length > 0 : false,
    likes: undefined,
    repostedBy: undefined,
    bookmarks: undefined,
    poll: post.poll
      ? {
          ...post.poll,
          userVoteId,
          options: pollOptions!.map(({ votes: _v, ...o }) => o),
        }
      : null,
  };

  return NextResponse.json({ data: enriched });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const post = await prisma.post.findUnique({ where: { id } });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (post.userId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.post.update({ where: { id }, data: { isDeleted: true } });
  await prisma.user.update({ where: { id: user.id }, data: { postsCount: { decrement: 1 } } });

  return NextResponse.json({ success: true });
}
