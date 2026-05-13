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
    include: { members: { select: { userId: true, joinedAt: true }, orderBy: { joinedAt: "asc" } } },
  });

  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!conversation.isGroup) return NextResponse.json({ error: "Not a group" }, { status: 400 });
  if (!conversation.members.some((m) => m.userId === user.id)) {
    return NextResponse.json({ error: "Not a member" }, { status: 400 });
  }

  const remaining = conversation.members.filter((m) => m.userId !== user.id);

  if (remaining.length === 0) {
    await prisma.conversation.delete({ where: { id: conversationId } });
  } else {
    await prisma.conversationMember.delete({
      where: { conversationId_userId: { conversationId, userId: user.id } },
    });

    const senderSelect = { id: true, username: true, displayName: true, avatarUrl: true, verified: true, email: true, bio: true, bannerUrl: true, location: true, website: true, isPrivate: true, followersCount: true, followingCount: true, postsCount: true, createdAt: true };

    const sysMsg = await prisma.message.create({
      data: { conversationId, senderId: user.id, content: `left the group`, isSystem: true },
      include: { sender: { select: senderSelect } },
    });

    // Transfer admin to earliest-joined remaining member
    let newAdminId: string | null = null;
    if (conversation.requesterId === user.id) {
      newAdminId = remaining[0].userId;
      await prisma.conversation.update({ where: { id: conversationId }, data: { requesterId: newAdminId, updatedAt: new Date() } });
    } else {
      await prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
    }

    const io = (global as { _io?: unknown })._io as { to: (room: string) => { emit: (event: string, data: unknown) => void } } | undefined;
    if (io) {
      io.to(conversationId).emit("member-left", { conversationId, userId: user.id });
      io.to(conversationId).emit("new-message", { ...sysMsg, reactions: [], isSystem: true, replyTo: null });
      if (newAdminId) {
        io.to(conversationId).emit("conv-updated", { conversationId, adminId: newAdminId });
      }

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
      // Notify remaining members (not the one who left)
      for (const m of remaining) {
        io.to(`user:${m.userId}`).emit("new-dm", dmPayload);
      }
    }
  }

  return NextResponse.json({ data: { ok: true } });
}
