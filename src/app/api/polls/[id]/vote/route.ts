import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({ optionId: z.string() });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: pollId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { optionId } = schema.parse(body);

  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
    include: { options: true },
  });
  if (!poll) return NextResponse.json({ error: "Poll not found" }, { status: 404 });
  if (poll.expiresAt < new Date()) return NextResponse.json({ error: "Poll has expired" }, { status: 400 });

  const existingVote = await prisma.pollVote.findUnique({
    where: { userId_pollId: { userId: user.id, pollId } },
  });

  if (existingVote) {
    if (existingVote.optionId === optionId) {
      return NextResponse.json({ error: "Already voted for this option" }, { status: 400 });
    }
    await prisma.$transaction([
      prisma.pollVote.update({ where: { userId_pollId: { userId: user.id, pollId } }, data: { optionId } }),
      prisma.pollOption.update({ where: { id: existingVote.optionId }, data: { votesCount: { decrement: 1 } } }),
      prisma.pollOption.update({ where: { id: optionId }, data: { votesCount: { increment: 1 } } }),
    ]);
  } else {
    await prisma.$transaction([
      prisma.pollVote.create({ data: { userId: user.id, pollId, optionId } }),
      prisma.pollOption.update({ where: { id: optionId }, data: { votesCount: { increment: 1 } } }),
    ]);
  }

  const updated = await prisma.poll.findUnique({
    where: { id: pollId },
    include: { options: true },
  });

  return NextResponse.json({ data: { ...updated, userVoteId: optionId } });
}
