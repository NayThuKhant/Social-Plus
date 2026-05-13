import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBlockedIds } from "@/lib/blocks";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [following, blockedIds] = await Promise.all([
    prisma.follow.findMany({ where: { followerId: user.id }, select: { followingId: true } }),
    getBlockedIds(user.id),
  ]);
  const followingIds = following.map((f) => f.followingId);
  const excludeIds = [...new Set([user.id, ...followingIds, ...blockedIds])];

  const suggestions = await prisma.user.findMany({
    where: {
      id: { notIn: excludeIds },
    },
    orderBy: { followersCount: "desc" },
    take: 10,
    select: {
      id: true, username: true, displayName: true, avatarUrl: true,
      bio: true, verified: true, followersCount: true,
    },
  });

  return NextResponse.json({ data: suggestions });
}
