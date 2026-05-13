import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const { conversationId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { members: { select: { userId: true } } },
  });

  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!conversation.members.some((m) => m.userId === user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!conversation.isRequest) {
    return NextResponse.json({ error: "Not a request" }, { status: 400 });
  }

  // Delete the entire conversation (cascades to messages, members)
  await prisma.conversation.delete({ where: { id: conversationId } });

  const io = (global as { _io?: unknown })._io as { to: (room: string) => { emit: (event: string, data: unknown) => void } } | undefined;
  if (io) {
    for (const member of conversation.members) {
      io.to(`user:${member.userId}`).emit("conv-declined", { conversationId });
    }
  }

  return NextResponse.json({ data: { deleted: true } });
}
