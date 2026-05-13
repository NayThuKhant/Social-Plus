import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Count conversations where the latest message is newer than lastReadAt
  const memberships = await prisma.conversationMember.findMany({
    where: { userId: user.id },
    select: {
      lastReadAt: true,
      conversation: {
        select: {
          messages: {
            where: { isDeleted: false },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { createdAt: true, senderId: true },
          },
        },
      },
    },
  });

  const count = memberships.filter(({ lastReadAt, conversation }) => {
    const last = conversation.messages[0];
    if (!last) return false;
    if (last.senderId === user.id) return false; // own message
    if (!lastReadAt) return true;
    return last.createdAt > lastReadAt;
  }).length;

  return NextResponse.json({ data: { count } });
}
