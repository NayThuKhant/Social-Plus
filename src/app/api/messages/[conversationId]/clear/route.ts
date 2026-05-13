import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({ scope: z.enum(["me", "all"]) });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const { conversationId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const member = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId: user.id } },
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { scope } = schema.parse(body);

  if (scope === "all") {
    const conv = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { isGroup: true, requesterId: true, members: { select: { userId: true } } },
    });
    if (!conv) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Groups: only admin can clear for everyone
    if (conv.isGroup && conv.requesterId !== user.id) {
      return NextResponse.json({ error: "Only the admin can clear for everyone" }, { status: 403 });
    }

    await prisma.message.deleteMany({ where: { conversationId } });

    // Notify all members in real-time
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const io = (global as any)._io;
    if (io) {
      io.to(conversationId).emit("conv-cleared", { conversationId });
      for (const m of conv.members) {
        io.to(`user:${m.userId}`).emit("conv-cleared", { conversationId });
      }
    }
  } else {
    await prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId: user.id } },
      data: { clearedAt: new Date() },
    });
  }

  return NextResponse.json({ data: { ok: true } });
}
