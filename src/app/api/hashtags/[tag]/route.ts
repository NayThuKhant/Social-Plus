import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tag: string }> }
) {
  const { tag } = await params;
  const url = new URL(req.url);
  const cursor = url.searchParams.get("cursor");
  const limit = 20;
  const viewer = await getCurrentUser();

  const hashtag = await prisma.hashtag.findUnique({ where: { tag: tag.toLowerCase() } });
  if (!hashtag) return NextResponse.json({ data: { hashtag: null, items: [], hasMore: false } });

  const postHashtags = await prisma.postHashtag.findMany({
    where: { hashtagId: hashtag.id, post: { isDeleted: false } },
    orderBy: { post: { createdAt: "desc" } },
    take: limit + 1,
    cursor: cursor ? { postId_hashtagId: { postId: cursor, hashtagId: hashtag.id } } : undefined,
    include: {
      post: {
        include: {
          user: true,
          quoteOf: { include: { user: true } },
          poll: {
            include: {
              options: {
                include: viewer
                  ? { votes: { where: { userId: viewer.id }, select: { optionId: true } } }
                  : {},
              },
            },
          },
          ...(viewer ? {
            likes: { where: { userId: viewer.id } },
            repostedBy: { where: { userId: viewer.id } },
            bookmarks: { where: { userId: viewer.id } },
          } : {}),
        },
      },
    },
  });

  const hasMore = postHashtags.length > limit;
  const items = (hasMore ? postHashtags.slice(0, limit) : postHashtags).map((ph) => {
    const opts = ph.post.poll?.options as Array<{ id: string; votes?: unknown[] }> | undefined;
    const userVoteId = opts?.find((o) => (o.votes?.length ?? 0) > 0)?.id ?? null;
    return {
      ...ph.post,
      isLiked: viewer ? ph.post.likes?.length > 0 : false,
      isReposted: viewer ? ph.post.repostedBy?.length > 0 : false,
      isBookmarked: viewer ? ph.post.bookmarks?.length > 0 : false,
      likes: undefined,
      repostedBy: undefined,
      bookmarks: undefined,
      poll: ph.post.poll
        ? { ...ph.post.poll, userVoteId, options: opts!.map(({ votes: _v, ...o }) => o) }
        : null,
    };
  });

  return NextResponse.json({
    data: {
      hashtag,
      items,
      nextCursor: hasMore ? items[items.length - 1].id : null,
      hasMore,
    },
  });
}
