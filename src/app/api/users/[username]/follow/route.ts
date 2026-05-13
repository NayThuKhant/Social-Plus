import { NextRequest, NextResponse } from "next/server";
import { NotificationType } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { emitNotification } from "@/lib/notify";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const viewer = await getCurrentUser();
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const target = await prisma.user.findUnique({ where: { username } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (target.id === viewer.id) return NextResponse.json({ error: "Cannot follow yourself" }, { status: 400 });

  const existing = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId: viewer.id, followingId: target.id } },
  });

  if (existing) {
    await prisma.$transaction([
      prisma.follow.delete({ where: { followerId_followingId: { followerId: viewer.id, followingId: target.id } } }),
      prisma.user.update({ where: { id: viewer.id }, data: { followingCount: { decrement: 1 } } }),
      prisma.user.update({ where: { id: target.id }, data: { followersCount: { decrement: 1 } } }),
    ]);
    return NextResponse.json({ following: false });
  } else {
    await prisma.$transaction([
      prisma.follow.create({ data: { followerId: viewer.id, followingId: target.id } }),
      prisma.user.update({ where: { id: viewer.id }, data: { followingCount: { increment: 1 } } }),
      prisma.user.update({ where: { id: target.id }, data: { followersCount: { increment: 1 } } }),
    ]);

    if (target.notifyFollows) {
      await prisma.notification.create({
        data: { userId: target.id, actorId: viewer.id, type: NotificationType.FOLLOW },
      }).catch(() => {});
      emitNotification(target.id, { type: NotificationType.FOLLOW, actorName: viewer.displayName, actorAvatar: viewer.avatarUrl ?? null });
    }

    return NextResponse.json({ following: true });
  }
}
