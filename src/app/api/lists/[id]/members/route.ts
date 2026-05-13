import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

const bodySchema = z.object({ username: z.string().min(1) });

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const list = await prisma.list.findUnique({ where: { id } });
  if (!list || list.ownerId !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const { username } = bodySchema.parse(await req.json());
    const target = await prisma.user.findUnique({ where: { username } });
    if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

    await prisma.listMember.upsert({
      where: { listId_userId: { listId: id, userId: target.id } },
      create: { listId: id, userId: target.id },
      update: {},
    });

    return NextResponse.json({ data: null }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? "Validation error" }, { status: 400 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const list = await prisma.list.findUnique({ where: { id } });
  if (!list || list.ownerId !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  await prisma.listMember.deleteMany({ where: { listId: id, userId } });
  return NextResponse.json({ data: null });
}
