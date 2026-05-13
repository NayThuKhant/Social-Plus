import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const list = await prisma.list.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      members: {
        include: {
          user: { select: { id: true, username: true, displayName: true, avatarUrl: true, bio: true } },
        },
        orderBy: { addedAt: "asc" },
      },
      _count: { select: { members: true } },
    },
  });

  if (!list) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (list.isPrivate && list.ownerId !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ data: list });
}

const patchSchema = z.object({
  name: z.string().min(1).max(25).optional(),
  description: z.string().max(100).optional(),
  isPrivate: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const list = await prisma.list.findUnique({ where: { id } });
  if (!list || list.ownerId !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const body = await req.json();
    const data = patchSchema.parse(body);
    const updated = await prisma.list.update({ where: { id }, data });
    return NextResponse.json({ data: updated });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? "Validation error" }, { status: 400 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const list = await prisma.list.findUnique({ where: { id } });
  if (!list || list.ownerId !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.list.delete({ where: { id } });
  return NextResponse.json({ data: null });
}
