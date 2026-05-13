import { prisma } from "@/lib/prisma";

/** Returns true if a block relationship exists in either direction between userA and userB. */
export async function hasBlock(userAId: string, userBId: string): Promise<boolean> {
  const block = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: userAId, blockedId: userBId },
        { blockerId: userBId, blockedId: userAId },
      ],
    },
    select: { blockerId: true },
  });
  return !!block;
}

/** Returns all user IDs that have a block relationship (either direction) with the given user. */
export async function getBlockedIds(userId: string): Promise<string[]> {
  const blocks = await prisma.block.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    select: { blockerId: true, blockedId: true },
  });
  return [...new Set(blocks.map((b) => (b.blockerId === userId ? b.blockedId : b.blockerId)))];
}
