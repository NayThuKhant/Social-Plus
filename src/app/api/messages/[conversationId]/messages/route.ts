import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasBlock } from "@/lib/blocks";

export async function GET(
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

  const url = new URL(req.url);
  const cursor = url.searchParams.get("cursor");
  const limit = 50;

  const messages = await prisma.message.findMany({
    where: {
      conversationId,
      NOT: { deletions: { some: { userId: user.id } } },
      ...(member.clearedAt ? { createdAt: { gt: member.clearedAt } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    cursor: cursor ? { id: cursor } : undefined,
    include: {
      sender: { select: { id: true, username: true, displayName: true, avatarUrl: true, verified: true } },
      replyTo: {
        include: { sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
      },
      reactions: { include: { user: { select: { id: true, username: true } } } },
    },
  });

  const hasMore = messages.length > limit;
  const items = (hasMore ? messages.slice(0, limit) : messages).reverse();

  await prisma.conversationMember.update({
    where: { conversationId_userId: { conversationId, userId: user.id } },
    data: { lastReadAt: new Date() },
  });

  return NextResponse.json({
    data: { items, nextCursor: hasMore ? messages[limit].id : null, hasMore },
  });
}

const sendSchema = z.object({
  content: z.string().min(1).max(1000).optional(),
  mediaUrls: z.array(z.string()).optional(),
  replyToId: z.string().optional(),
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

  // For 1:1 conversations, enforce block and request-state rules
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { isGroup: true, isRequest: true, requesterId: true, name: true, avatarUrl: true, members: { select: { userId: true } } },
  });
  if (conv && !conv.isGroup) {
    const otherMemberId = conv.members.find((m) => m.userId !== user.id)?.userId;
    if (otherMemberId && otherMemberId !== user.id) {
      const blocked = await hasBlock(user.id, otherMemberId);
      if (blocked) return NextResponse.json({ error: "Cannot message this user" }, { status: 403 });
    }
    // If this is a pending request, only the requester can add messages (recipient must accept first)
    if (conv.isRequest && conv.requesterId !== user.id) {
      return NextResponse.json({ error: "Accept the message request to reply" }, { status: 403 });
    }
  }

  try {
    const body = await req.json();
    const data = sendSchema.parse(body);

    if (!data.content && (!data.mediaUrls || data.mediaUrls.length === 0)) {
      return NextResponse.json({ error: "Empty message" }, { status: 400 });
    }

    const message = await prisma.message.create({
      data: {
        conversationId,
        senderId: user.id,
        content: data.content,
        mediaUrls: data.mediaUrls || [],
        replyToId: data.replyToId,
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

    // Emit to conversation room (for participants currently in the DM page)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const io = (global as any)._io;
    if (io) {
      io.to(conversationId).emit("new-message", message);
      // Also notify each member's personal room so they get it anywhere in the app
      const members = await prisma.conversationMember.findMany({
        where: { conversationId },
        select: { userId: true },
      });
      for (const m of members) {
        if (m.userId !== user.id) {
          io.to(`user:${m.userId}`).emit("new-dm", {
            message,
            conversationId,
            isReply: !!data.replyToId,
            ...(conv?.isGroup ? { isGroup: true, groupName: conv.name, groupAvatar: conv.avatarUrl } : {}),
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
