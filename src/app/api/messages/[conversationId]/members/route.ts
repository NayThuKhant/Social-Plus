import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
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
  if (!conversation.isGroup) return NextResponse.json({ error: "Not a group" }, { status: 400 });
  if (!conversation.members.some((m) => m.userId === user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as { userId: string };
  if (!body.userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  // Avoid duplicate
  if (conversation.members.some((m) => m.userId === body.userId)) {
    return NextResponse.json({ error: "Already a member" }, { status: 400 });
  }

  const newMember = await prisma.user.findUnique({
    where: { id: body.userId },
    select: { id: true, username: true, displayName: true, avatarUrl: true, verified: true },
  });

  await prisma.conversationMember.create({
    data: { conversationId, userId: body.userId },
  });

  // System activity message
  const sysMsg = await prisma.message.create({
    data: {
      conversationId,
      senderId: user.id,
      content: `added ${newMember?.displayName ?? "someone"} to the group`,
      isSystem: true,
    },
    include: { sender: { select: { id: true, username: true, displayName: true, avatarUrl: true, verified: true, email: true, bio: true, bannerUrl: true, location: true, website: true, isPrivate: true, followersCount: true, followingCount: true, postsCount: true, createdAt: true } } },
  });

  await prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });

  const io = (global as { _io?: unknown })._io as { to: (room: string) => { emit: (event: string, data: unknown) => void } } | undefined;
  if (io) {
    io.to(conversationId).emit("member-added", { conversationId, userId: body.userId, user: newMember });
    io.to(conversationId).emit("new-message", { ...sysMsg, reactions: [], isSystem: true, replyTo: null });

    const dmPayload = {
      conversationId,
      isGroup: true,
      groupName: conversation.name,
      groupAvatar: conversation.avatarUrl,
      isSystem: true,
      message: {
        id: sysMsg.id,
        content: sysMsg.content,
        sender: { displayName: sysMsg.sender.displayName, avatarUrl: sysMsg.sender.avatarUrl },
      },
    };
    // Notify all existing members except the actor
    for (const m of conversation.members) {
      if (m.userId !== user.id) io.to(`user:${m.userId}`).emit("new-dm", dmPayload);
    }
    // Notify the newly added member
    io.to(`user:${body.userId}`).emit("new-dm", dmPayload);
  }

  return NextResponse.json({ data: { ok: true, user: newMember } });
}

export async function DELETE(
  req: NextRequest,
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
  if (!conversation.isGroup) return NextResponse.json({ error: "Not a group" }, { status: 400 });
  if (!conversation.members.some((m) => m.userId === user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as { userId: string };
  if (!body.userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  if (!conversation.members.some((m) => m.userId === body.userId)) {
    return NextResponse.json({ error: "Not a member" }, { status: 400 });
  }

  const removedUser = await prisma.user.findUnique({
    where: { id: body.userId },
    select: { displayName: true },
  });

  const remainingAfter = conversation.members.filter((m) => m.userId !== body.userId).length;

  if (remainingAfter === 0) {
    await prisma.conversation.delete({ where: { id: conversationId } });
  } else {
    await prisma.conversationMember.delete({
      where: { conversationId_userId: { conversationId, userId: body.userId } },
    });

    const sysMsg = await prisma.message.create({
      data: {
        conversationId,
        senderId: user.id,
        content: `removed ${removedUser?.displayName ?? "someone"} from the group`,
        isSystem: true,
      },
      include: { sender: { select: { id: true, username: true, displayName: true, avatarUrl: true, verified: true, email: true, bio: true, bannerUrl: true, location: true, website: true, isPrivate: true, followersCount: true, followingCount: true, postsCount: true, createdAt: true } } },
    });

    await prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });

    const io = (global as { _io?: unknown })._io as { to: (room: string) => { emit: (event: string, data: unknown) => void } } | undefined;
    if (io) {
      io.to(conversationId).emit("member-removed", { conversationId, userId: body.userId });
      io.to(conversationId).emit("new-message", { ...sysMsg, reactions: [], isSystem: true, replyTo: null });
      // Notify removed user so their inbox disappears
      io.to(`user:${body.userId}`).emit("conv-removed", { conversationId });

      const dmPayload = {
        conversationId,
        isGroup: true,
        groupName: conversation.name,
        groupAvatar: conversation.avatarUrl,
        isSystem: true,
        message: {
          id: sysMsg.id,
          content: sysMsg.content,
          sender: { displayName: sysMsg.sender.displayName, avatarUrl: sysMsg.sender.avatarUrl },
        },
      };
      // Notify remaining members except the actor
      for (const m of conversation.members) {
        if (m.userId !== user.id && m.userId !== body.userId) {
          io.to(`user:${m.userId}`).emit("new-dm", dmPayload);
        }
      }
    }
  }

  return NextResponse.json({ data: { ok: true } });
}
