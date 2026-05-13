import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBlockedIds } from "@/lib/blocks";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ?ids=true → return flat array of user IDs with block relationship in either direction
  if (new URL(req.url).searchParams.get("ids") === "true") {
    const ids = await getBlockedIds(user.id);
    return NextResponse.json({ data: ids });
  }

  const blocks = await prisma.block.findMany({
    where: { blockerId: user.id },
    include: {
      blocked: {
        select: { id: true, username: true, displayName: true, avatarUrl: true, bio: true, verified: true, followersCount: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: blocks.map((b) => b.blocked) });
}
