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
  // Only the recipient (non-requester) can accept
  if (conversation.requesterId === user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await prisma.conversation.update({
    where: { id: conversationId },
    data: { isRequest: false, requesterId: null },
  });

  const io = (global as { _io?: unknown })._io as { to: (room: string) => { emit: (event: string, data: unknown) => void } } | undefined;
  if (io) {
    for (const member of conversation.members) {
      io.to(`user:${member.userId}`).emit("conv-accepted", { conversationId });
    }
  }

  return NextResponse.json({ data: { conversation: updated } });
}
