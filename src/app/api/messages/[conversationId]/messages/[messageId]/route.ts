import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({ scope: z.enum(["me", "all"]) });

export async function DELETE(
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

  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message || message.conversationId !== conversationId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const { scope } = schema.parse(body);

  if (scope === "all") {
    if (message.senderId !== user.id) {
      return NextResponse.json({ error: "Only the sender can delete for everyone" }, { status: 403 });
    }
    await prisma.message.update({ where: { id: messageId }, data: { isDeleted: true } });
  } else {
    await prisma.messageDeletion.upsert({
      where: { messageId_userId: { messageId, userId: user.id } },
      create: { messageId, userId: user.id },
      update: {},
    });
  }

  const io = (global as { _io?: unknown })._io as { to: (r: string) => { emit: (e: string, d: unknown) => void } } | undefined;
  if (io && scope === "all") {
    io.to(conversationId).emit("message-deleted", { messageId, scope: "all", deletedByName: user.displayName });
  }

  return NextResponse.json({ data: { ok: true } });
}
