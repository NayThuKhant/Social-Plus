import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { callMessageContent } from "@/lib/callLog";

const bodySchema = z.object({
  type: z.enum(["missed", "ended"]),
  isVideo: z.boolean().default(false),
  duration: z.number().optional(),
});

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

  try {
    const body = await req.json();
    const data = bodySchema.parse(body);

    const content = callMessageContent(data.type, data.isVideo, data.duration);

    const conv = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { isGroup: true, name: true, avatarUrl: true, members: { select: { userId: true } } },
    });
    if (!conv) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const message = await prisma.message.create({
      data: {
        conversationId,
        senderId: user.id,
        content,
        isSystem: true,
      },
      include: {
        sender: { select: { id: true, username: true, displayName: true, avatarUrl: true, verified: true } },
        replyTo: {
          include: { sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
        },
        reactions: { include: { user: { select: { id: true, username: true } } } },
      },
    });

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const io = (global as any)._io;
    if (io) {
      io.to(conversationId).emit("new-message", message);
      for (const m of conv.members) {
        if (m.userId !== user.id) {
          io.to(`user:${m.userId}`).emit("new-dm", {
            message,
            conversationId,
            isSystem: true,
            ...(conv.isGroup ? { isGroup: true, groupName: conv.name, groupAvatar: conv.avatarUrl } : {}),
          });
        }
      }
    }

    return NextResponse.json({ data: message }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? "Validation error" }, { status: 400 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
