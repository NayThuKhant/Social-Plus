import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const cursor = url.searchParams.get("cursor");
  const type = url.searchParams.get("type");
  const limit = 20;

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id, ...(type ? { type: type as never } : {}) },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    cursor: cursor ? { id: cursor } : undefined,
    include: {
      actor: { select: { id: true, username: true, displayName: true, avatarUrl: true, verified: true } },
      post: {
        select: { id: true, content: true, mediaUrls: true, user: { select: { username: true } } },
      },
    },
  });

  const hasMore = notifications.length > limit;
  const items = hasMore ? notifications.slice(0, limit) : notifications;

  // Mark as read — run in background, return items with isRead: true immediately
  prisma.notification.updateMany({
    where: { userId: user.id, isRead: false },
    data: { isRead: true },
  }).catch(() => {});

  return NextResponse.json({
    data: {
      items: items.map((n) => ({ ...n, isRead: true })),
      nextCursor: hasMore ? items[items.length - 1].id : null,
      hasMore,
    },
  });
}
