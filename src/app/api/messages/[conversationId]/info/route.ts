import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const URL_RE = /https?:\/\/[^\s]+/gi;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const { conversationId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const member = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId: user.id } },
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Media messages
  const mediaMessages = await prisma.message.findMany({
    where: { conversationId, isDeleted: false, mediaUrls: { isEmpty: false } },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, mediaUrls: true, createdAt: true },
  });

  // Link messages
  const linkMessages = await prisma.message.findMany({
    where: { conversationId, isDeleted: false, content: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, content: true, createdAt: true, sender: { select: { displayName: true, avatarUrl: true } } },
  });

  const links = linkMessages
    .flatMap((m) => {
      const urls = m.content?.match(URL_RE) ?? [];
      return urls.map((url) => ({ url, messageId: m.id, createdAt: m.createdAt, sender: m.sender }));
    })
    .slice(0, 50);

  return NextResponse.json({ data: { mediaMessages, links } });
}
