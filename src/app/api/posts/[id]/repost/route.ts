import { NextRequest, NextResponse } from "next/server";
import { NotificationType } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { emitNotification } from "@/lib/notify";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: postId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await prisma.repost.findUnique({
    where: { userId_postId: { userId: user.id, postId } },
  });

  if (existing) {
    await prisma.$transaction([
      prisma.repost.delete({ where: { userId_postId: { userId: user.id, postId } } }),
      prisma.post.update({ where: { id: postId }, data: { repostsCount: { decrement: 1 } } }),
    ]);
    return NextResponse.json({ reposted: false });
  } else {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { userId: true, user: { select: { notifyReposts: true } } },
    });

    await prisma.$transaction([
      prisma.repost.create({ data: { userId: user.id, postId } }),
      prisma.post.update({ where: { id: postId }, data: { repostsCount: { increment: 1 } } }),
    ]);

    if (post && post.userId !== user.id && post.user.notifyReposts) {
      await prisma.notification.create({
        data: { userId: post.userId, actorId: user.id, type: NotificationType.REPOST, postId },
      }).catch(() => {});
      emitNotification(post.userId, { type: NotificationType.REPOST, actorName: user.displayName, actorAvatar: user.avatarUrl ?? null, postId });
    }

    return NextResponse.json({ reposted: true });
  }
}
