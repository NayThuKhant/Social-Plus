import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const viewer = await getCurrentUser();

  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true, email: true, username: true, displayName: true,
      bio: true, avatarUrl: true, bannerUrl: true, location: true,
      website: true, verified: true, isPrivate: true,
      followersCount: true, followingCount: true, postsCount: true,
      createdAt: true,
    },
  });

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  let isFollowing = false;
  let isFollowedBy = false;
  let isBlockedByMe = false;
  let isBlockingMe = false;
  if (viewer) {
    const [fwd, rev, blockMade, blockReceived] = await Promise.all([
      prisma.follow.findUnique({ where: { followerId_followingId: { followerId: viewer.id, followingId: user.id } } }),
      prisma.follow.findUnique({ where: { followerId_followingId: { followerId: user.id, followingId: viewer.id } } }),
      prisma.block.findUnique({ where: { blockerId_blockedId: { blockerId: viewer.id, blockedId: user.id } } }),
      prisma.block.findUnique({ where: { blockerId_blockedId: { blockerId: user.id, blockedId: viewer.id } } }),
    ]);
    isFollowing = !!fwd;
    isFollowedBy = !!rev;
    isBlockedByMe = !!blockMade;
    isBlockingMe = !!blockReceived;
  }

  return NextResponse.json({ data: { ...user, isFollowing, isFollowedBy, isBlockedByMe, isBlockingMe } });
}

const updateSchema = z.object({
  displayName: z.string().min(1).max(50).optional(),
  bio: z.string().max(160).optional(),
  location: z.string().max(30).optional(),
  website: z.string().url().optional().or(z.literal("")),
  avatarUrl: z.string().url().nullish(),
  bannerUrl: z.string().url().nullish(),
  isPrivate: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const viewer = await getCurrentUser();
  if (!viewer || viewer.username !== username) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const data = updateSchema.parse(body);
    const updated = await prisma.user.update({ where: { username }, data });
    const { passwordHash, ...safe } = updated;
    void passwordHash;
    return NextResponse.json({ data: safe });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? "Validation error" }, { status: 400 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
