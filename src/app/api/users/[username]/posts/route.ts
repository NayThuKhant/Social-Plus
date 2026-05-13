import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const url = new URL(req.url);
  const cursor = url.searchParams.get("cursor");
  const tab = url.searchParams.get("tab") || "posts"; // posts | replies | media | likes
  const limit = 20;
  const viewer = await getCurrentUser();

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const isOwner = viewer?.id === user.id;

  // Private account: return empty for non-followers
  if (user.isPrivate && !isOwner) {
    if (!viewer) return NextResponse.json({ data: { items: [], nextCursor: null, hasMore: false } });
    const follows = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: viewer.id, followingId: user.id } },
    });
    if (!follows) return NextResponse.json({ data: { items: [], nextCursor: null, hasMore: false } });
  }

  const scheduledFilter = isOwner
    ? {}
    : { OR: [{ scheduledAt: null }, { scheduledAt: { lte: new Date() } }] };

  let where: Record<string, unknown> = { userId: user.id, isDeleted: false, ...scheduledFilter };
  if (tab === "posts") where = { ...where, replyToId: null };
  if (tab === "replies") where = { ...where, replyToId: { not: null } };
  if (tab === "media") where = { ...where, mediaUrls: { isEmpty: false } };

  let posts;
  if (tab === "likes") {
    const liked = await prisma.like.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      cursor: cursor ? { userId_postId: { userId: user.id, postId: cursor } } : undefined,
      include: {
        post: {
          include: {
            user: true,
            quoteOf: { include: { user: true } },
            ...(viewer ? {
              likes: { where: { userId: viewer.id } },
              repostedBy: { where: { userId: viewer.id } },
              bookmarks: { where: { userId: viewer.id } },
            } : {}),
          },
        },
      },
    });

    const hasMore = liked.length > limit;
    const items = (hasMore ? liked.slice(0, limit) : liked).map((l) => ({
      ...l.post,
      isLiked: viewer ? l.post.likes?.length > 0 : false,
      isReposted: viewer ? l.post.repostedBy?.length > 0 : false,
      isBookmarked: viewer ? l.post.bookmarks?.length > 0 : false,
      likes: undefined,
      repostedBy: undefined,
      bookmarks: undefined,
    }));

    return NextResponse.json({
      data: { items, nextCursor: hasMore ? items[items.length - 1].id : null, hasMore },
    });
  }

  posts = await prisma.post.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    cursor: cursor ? { id: cursor } : undefined,
    include: {
      user: true,
      replyTo: { include: { user: true } },
      quoteOf: { include: { user: true } },
      poll: { include: { options: { include: { ...(viewer ? { votes: { where: { userId: viewer.id } } } : {}) } } } },
      ...(viewer ? {
        likes: { where: { userId: viewer.id } },
        repostedBy: { where: { userId: viewer.id } },
        bookmarks: { where: { userId: viewer.id } },
      } : {}),
    },
  });

  const hasMore = posts.length > limit;
  const items = (hasMore ? posts.slice(0, limit) : posts).map((p) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const options = p.poll?.options as any[];
    const userVoteId = options?.find((o) => o.votes?.length > 0)?.id ?? null;
    return {
      ...p,
      isLiked: viewer ? p.likes?.length > 0 : false,
      isReposted: viewer ? p.repostedBy?.length > 0 : false,
      isBookmarked: viewer ? p.bookmarks?.length > 0 : false,
      likes: undefined,
      repostedBy: undefined,
      bookmarks: undefined,
      poll: p.poll
        ? {
            ...p.poll,
            userVoteId,
            options: options.map(({ votes: _v, ...o }: { votes: unknown; [k: string]: unknown }) => o),
          }
        : null,
    };
  });

  return NextResponse.json({
    data: { items, nextCursor: hasMore ? items[items.length - 1].id : null, hasMore },
  });
}
