import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const target = await prisma.user.findUnique({ where: { username } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (target.id === user.id) return NextResponse.json({ error: "Cannot block yourself" }, { status: 400 });

  const existing = await prisma.block.findUnique({
    where: { blockerId_blockedId: { blockerId: user.id, blockedId: target.id } },
  });

  const io = (global as { _io?: unknown })._io as { to: (room: string) => { emit: (event: string, data: unknown) => void } } | undefined;

  if (existing) {
    await prisma.block.delete({ where: { blockerId_blockedId: { blockerId: user.id, blockedId: target.id } } });
    if (io) {
      io.to(`user:${user.id}`).emit("block-changed", { by: user.id, targetId: target.id, blocked: false });
      io.to(`user:${target.id}`).emit("block-changed", { by: user.id, targetId: target.id, blocked: false });
    }
    return NextResponse.json({ data: { blocked: false } });
  } else {
    // Delete follow relationships in both directions and decrement counts
    const [aFollowsB, bFollowsA] = await Promise.all([
      prisma.follow.findUnique({ where: { followerId_followingId: { followerId: user.id, followingId: target.id } } }),
      prisma.follow.findUnique({ where: { followerId_followingId: { followerId: target.id, followingId: user.id } } }),
    ]);

    const ops: Promise<unknown>[] = [
      prisma.block.create({ data: { blockerId: user.id, blockedId: target.id } }),
    ];
    if (aFollowsB) {
      ops.push(prisma.follow.delete({ where: { followerId_followingId: { followerId: user.id, followingId: target.id } } }));
      ops.push(prisma.user.update({ where: { id: user.id }, data: { followingCount: { decrement: 1 } } }));
      ops.push(prisma.user.update({ where: { id: target.id }, data: { followersCount: { decrement: 1 } } }));
    }
    if (bFollowsA) {
      ops.push(prisma.follow.delete({ where: { followerId_followingId: { followerId: target.id, followingId: user.id } } }));
      ops.push(prisma.user.update({ where: { id: target.id }, data: { followingCount: { decrement: 1 } } }));
      ops.push(prisma.user.update({ where: { id: user.id }, data: { followersCount: { decrement: 1 } } }));
    }
    await Promise.all(ops);

    if (io) {
      io.to(`user:${user.id}`).emit("block-changed", { by: user.id, targetId: target.id, blocked: true });
      io.to(`user:${target.id}`).emit("block-changed", { by: user.id, targetId: target.id, blocked: true });
    }
    return NextResponse.json({ data: { blocked: true } });
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: { blocked: false, blockedByThem: false } });

  const target = await prisma.user.findUnique({ where: { username } });
  if (!target) return NextResponse.json({ data: { blocked: false, blockedByThem: false } });

  const [myBlock, theirBlock] = await Promise.all([
    prisma.block.findUnique({ where: { blockerId_blockedId: { blockerId: user.id, blockedId: target.id } } }),
    prisma.block.findUnique({ where: { blockerId_blockedId: { blockerId: target.id, blockedId: user.id } } }),
  ]);

  return NextResponse.json({ data: { blocked: !!myBlock, blockedByThem: !!theirBlock } });
}
