import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({ emoji: z.string().min(1).max(8) });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ conversationId: string; messageId: string }> }
) {
  const { conversationId, messageId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const member = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId: user.id } },
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { emoji } = schema.parse(body);

  const existing = await prisma.messageReaction.findUnique({
    where: { messageId_userId: { messageId, userId: user.id } },
  });

  if (existing) {
    if (existing.emoji === emoji) {
      // Same emoji — toggle off
      await prisma.messageReaction.delete({ where: { id: existing.id } });
    } else {
      // Different emoji — override
      await prisma.messageReaction.update({ where: { id: existing.id }, data: { emoji } });
    }
  } else {
    await prisma.messageReaction.create({ data: { messageId, userId: user.id, emoji } });
  }

  const [reactions, msg] = await Promise.all([
    prisma.messageReaction.findMany({
      where: { messageId },
      include: { user: { select: { id: true, username: true } } },
    }),
    prisma.message.findUnique({
      where: { id: messageId },
      select: { senderId: true },
    }),
  ]);

  const io = (global as { _io?: unknown })._io as { to: (room: string) => { emit: (event: string, data: unknown) => void } } | undefined;
  if (io) {
    io.to(conversationId).emit("message-reaction", { messageId, reactions });
    // Notify message owner only when adding/changing a reaction (not removing)
    const isRemoving = existing && existing.emoji === emoji;
    if (msg && msg.senderId !== user.id && !isRemoving) {
      io.to(`user:${msg.senderId}`).emit("new-dm", {
        message: { id: messageId, content: null, sender: { displayName: user.displayName, avatarUrl: user.avatarUrl ?? null } },
        conversationId,
        type: "reaction",
        emoji,
      });
    }
  }

  return NextResponse.json({ data: { reactions } });
}
