import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { NotificationType } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { extractHashtags, extractMentions } from "@/lib/utils";
import { emitNotification } from "@/lib/notify";

const createSchema = z.object({
  content: z.string().max(280).optional(),
  mediaUrls: z.array(z.string()).max(4).optional(),
  mediaTypes: z.array(z.string()).max(4).optional(),
  replyToId: z.string().optional(),
  quoteOfId: z.string().optional(),
  scheduledAt: z.string().datetime().optional(),
  poll: z
    .object({
      options: z.array(z.string().min(1).max(25)).min(2).max(4),
      expiresAt: z.string().datetime(),
    })
    .optional(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const data = createSchema.parse(body);

    if (!data.content && (!data.mediaUrls || data.mediaUrls.length === 0) && !data.poll) {
      return NextResponse.json({ error: "Post must have content, media, or a poll" }, { status: 400 });
    }

    const post = await prisma.$transaction(async (tx) => {
      const created = await tx.post.create({
        data: {
          userId: user.id,
          content: data.content,
          mediaUrls: data.mediaUrls || [],
          mediaTypes: data.mediaTypes || [],
          replyToId: data.replyToId,
          quoteOfId: data.quoteOfId,
          scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
          publishedAt: data.scheduledAt ? null : new Date(),
        },
        include: { user: true, poll: { include: { options: true } } },
      });

      // Poll
      if (data.poll) {
        const poll = await tx.poll.create({
          data: {
            postId: created.id,
            expiresAt: new Date(data.poll.expiresAt),
            options: { create: data.poll.options.map((text) => ({ text })) },
          },
        });
        void poll;
      }

      // Hashtags
      if (data.content) {
        const tags = extractHashtags(data.content);
        for (const tag of tags) {
          const hashtag = await tx.hashtag.upsert({
            where: { tag },
            create: { tag, postsCount: 1 },
            update: { postsCount: { increment: 1 } },
          });
          await tx.postHashtag.create({
            data: { postId: created.id, hashtagId: hashtag.id },
          }).catch(() => {});
        }
      }

      // Update counts
      if (data.replyToId) {
        await tx.post.update({
          where: { id: data.replyToId },
          data: { repliesCount: { increment: 1 } },
        });
      }
      if (data.quoteOfId) {
        await tx.post.update({
          where: { id: data.quoteOfId },
          data: { quotesCount: { increment: 1 } },
        });
      }

      await tx.user.update({
        where: { id: user.id },
        data: { postsCount: { increment: 1 } },
      });

      // Notifications for mentions
      if (data.content) {
        const mentions = extractMentions(data.content);
        for (const username of mentions) {
          const mentioned = await tx.user.findUnique({ where: { username } });
          if (mentioned && mentioned.id !== user.id && mentioned.notifyMentions) {
            await tx.notification.create({
              data: {
                userId: mentioned.id,
                actorId: user.id,
                type: NotificationType.MENTION,
                postId: created.id,
              },
            });
            emitNotification(mentioned.id, { type: NotificationType.MENTION, actorName: user.displayName, actorAvatar: user.avatarUrl ?? null, postId: created.id });
          }
        }
      }

      // Notification for reply
      if (data.replyToId) {
        const parentPost = await tx.post.findUnique({
          where: { id: data.replyToId },
          select: { userId: true, user: { select: { notifyReplies: true } } },
        });
        if (parentPost && parentPost.userId !== user.id && parentPost.user.notifyReplies) {
          await tx.notification.create({
            data: {
              userId: parentPost.userId,
              actorId: user.id,
              type: NotificationType.REPLY,
              postId: created.id,
            },
          });
          emitNotification(parentPost.userId, { type: NotificationType.REPLY, actorName: user.displayName, actorAvatar: user.avatarUrl ?? null, postId: created.id });
        }
      }

      return created;
    });

    return NextResponse.json({ data: post }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? "Validation error" }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
