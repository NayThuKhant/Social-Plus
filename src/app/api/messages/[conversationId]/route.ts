import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const { conversationId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { members: { select: { userId: true }, orderBy: { joinedAt: "asc" } } },
  });

  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!conversation.isGroup) return NextResponse.json({ error: "Not a group" }, { status: 400 });
  if (!conversation.members.some((m) => m.userId === user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as { name?: string; avatarUrl?: string };
  const nameChanged = body.name !== undefined && body.name !== conversation.name;
  const updated = await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.avatarUrl !== undefined ? { avatarUrl: body.avatarUrl } : {}),
    },
  });

  const senderSelect = { id: true, username: true, displayName: true, avatarUrl: true, verified: true, email: true, bio: true, bannerUrl: true, location: true, website: true, isPrivate: true, followersCount: true, followingCount: true, postsCount: true, createdAt: true };
  let sysMsg = null;
  if (nameChanged) {
    sysMsg = await prisma.message.create({
      data: {
        conversationId,
        senderId: user.id,
        content: `changed the group name to "${body.name}"`,
        isSystem: true,
      },
      include: { sender: { select: senderSelect } },
    });
  }

  const io = (global as { _io?: unknown })._io as { to: (room: string) => { emit: (event: string, data: unknown) => void } } | undefined;
  if (io) {
    io.to(conversationId).emit("conv-updated", { conversationId, name: updated.name, avatarUrl: updated.avatarUrl });
    if (sysMsg) {
      io.to(conversationId).emit("new-message", { ...sysMsg, reactions: [], isSystem: true, replyTo: null });

      const dmPayload = {
        conversationId,
        isGroup: true,
        groupName: updated.name,
        groupAvatar: updated.avatarUrl,
        isSystem: true,
        message: {
          id: sysMsg.id,
          content: sysMsg.content,
          sender: { displayName: sysMsg.sender.displayName, avatarUrl: sysMsg.sender.avatarUrl },
        },
      };
      for (const m of conversation.members) {
        if (m.userId !== user.id) io.to(`user:${m.userId}`).emit("new-dm", dmPayload);
      }
    }
  }

  return NextResponse.json({ data: { conversation: updated } });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const { conversationId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      members: {
        include: {
          user: { select: { id: true, username: true, displayName: true, avatarUrl: true, verified: true } },
        },
      },
    },
  });

  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isMember = conversation.members.some((m) => m.userId === user.id);
  if (!isMember) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json({
    data: {
      ...conversation,
      members: conversation.members.map((m) => m.user),
    },
  });
}
