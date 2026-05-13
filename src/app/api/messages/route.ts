import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasBlock } from "@/lib/blocks";

const memberSelect = {
  include: {
    user: { select: { id: true, username: true, displayName: true, avatarUrl: true, verified: true } },
  },
};

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const recipientId = searchParams.get("recipientId");

  if (recipientId) {
    const conversation = await prisma.conversation.findFirst({
      where: {
        isGroup: false,
        AND: [
          { members: { some: { userId: user.id } } },
          { members: { some: { userId: recipientId } } },
        ],
      },
      select: { id: true },
    });
    return NextResponse.json({ data: conversation });
  }

  const conversations = await prisma.conversation.findMany({
    where: { members: { some: { userId: user.id } } },
    orderBy: { updatedAt: "desc" },
    include: {
      members: memberSelect,
      messages: {
        where: { isDeleted: false },
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { sender: { select: { id: true, username: true } } },
      },
    },
  });

  const memberships = await prisma.conversationMember.findMany({
    where: { userId: user.id, conversationId: { in: conversations.map((c) => c.id) } },
    select: { conversationId: true, lastReadAt: true, clearedAt: true },
  });
  const membershipMap = new Map(memberships.map((m) => [m.conversationId, m]));

  const formatted = conversations.map((c) => {
    const membership = membershipMap.get(c.id);
    const clearedAt = membership?.clearedAt;
    const raw = c.messages[0] ?? null;

    // Suppress preview if the message predates the user's clear-history action
    const lastMsg = raw && clearedAt && raw.createdAt <= clearedAt ? null : raw;

    const lastReadAt = membership?.lastReadAt;
    const isUnread =
      !!lastMsg &&
      lastMsg.sender.id !== user.id &&
      (!lastReadAt || lastMsg.createdAt > lastReadAt);

    return {
      ...c,
      members: c.members.map((m) => m.user),
      lastMessage: lastMsg,
      messages: undefined,
      unreadCount: isUnread ? 1 : 0,
    };
  });

  return NextResponse.json({ data: formatted });
}

const createSchema = z.object({
  recipientId: z.string().optional(),
  recipientIds: z.array(z.string()).optional(),
  name: z.string().optional(),
  avatarUrl: z.string().url().optional(),
  message: z.string().max(1000).optional(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const data = createSchema.parse(body);

    const memberIds = data.recipientIds || (data.recipientId ? [data.recipientId] : []);
    if (memberIds.length === 0) {
      return NextResponse.json({ error: "No recipients specified" }, { status: 400 });
    }

    const allIds = [...new Set([user.id, ...memberIds])];
    const isGroup = allIds.length > 2;
    const isSelf = !isGroup && memberIds.length === 1 && memberIds[0] === user.id;

    let isRequest = false;

    if (!isGroup && !isSelf) {
      const recipientId = memberIds[0];

      const blocked = await hasBlock(user.id, recipientId);
      if (blocked) return NextResponse.json({ error: "Cannot message this user" }, { status: 403 });

      // Check for existing conversation — if one exists, always allow (ongoing relationship)
      const existing = await prisma.conversation.findFirst({
        where: {
          isGroup: false,
          AND: [
            { members: { some: { userId: user.id } } },
            { members: { some: { userId: recipientId } } },
          ],
        },
        include: { members: memberSelect },
      });

      if (existing) {
        // Reuse existing conversation
        const message = await prisma.message.create({
          data: { conversationId: existing.id, senderId: user.id, content: data.message },
          include: { sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
        });
        await prisma.conversation.update({ where: { id: existing.id }, data: { updatedAt: new Date() } });
        return NextResponse.json({
          data: { conversation: { ...existing, members: existing.members.map((m) => m.user) }, message },
        }, { status: 201 });
      }

      // New conversation — check mutual follow to decide active vs. request
      const [aFollowsB, bFollowsA] = await Promise.all([
        prisma.follow.findUnique({ where: { followerId_followingId: { followerId: user.id, followingId: recipientId } } }),
        prisma.follow.findUnique({ where: { followerId_followingId: { followerId: recipientId, followingId: user.id } } }),
      ]);
      isRequest = !(aFollowsB && bFollowsA);
    }

    const conversation = await prisma.conversation.create({
      data: {
        isGroup,
        name: data.name,
        avatarUrl: isGroup ? (data.avatarUrl ?? null) : null,
        isRequest,
        // For groups: requesterId tracks the creator; for 1:1 requests: tracks the requester
        requesterId: isRequest ? user.id : (isGroup ? user.id : null),
        members: { create: allIds.map((userId) => ({ userId })) },
      },
      include: { members: memberSelect },
    });

    // Initial message is optional for groups
    let message = null;
    if (data.message) {
      message = await prisma.message.create({
        data: { conversationId: conversation.id, senderId: user.id, content: data.message },
        include: { sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
      });
    }

    await prisma.conversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });

    // Notify recipients via socket
    const io = (global as { _io?: unknown })._io as { to: (room: string) => { emit: (event: string, data: unknown) => void } } | undefined;
    if (io) {
      const recipientIds = conversation.members.map((m) => m.user.id).filter((id) => id !== user.id);
      for (const recipientId of recipientIds) {
        io.to(`user:${recipientId}`).emit("new-dm", {
          message: message ? { id: message.id, content: message.content, sender: { displayName: user.displayName, avatarUrl: user.avatarUrl ?? null } } : null,
          conversationId: conversation.id,
          isRequest,
          isGroup,
          groupName: data.name,
          groupAvatar: isGroup ? (data.avatarUrl ?? null) : null,
        });
      }
    }

    return NextResponse.json({
      data: { conversation: { ...conversation, members: conversation.members.map((m) => m.user) }, message },
    }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? "Validation error" }, { status: 400 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
