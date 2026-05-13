import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const post = await prisma.post.findUnique({ where: { id } });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (post.userId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const newPinned = !post.isPinned;

  // Unpin any existing pinned post first
  if (newPinned) {
    await prisma.post.updateMany({
      where: { userId: user.id, isPinned: true },
      data: { isPinned: false },
    });
  }

  const updated = await prisma.post.update({
    where: { id },
    data: { isPinned: newPinned },
  });

  return NextResponse.json({ data: { isPinned: updated.isPinned } });
}
