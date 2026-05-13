import { NotificationType } from "@prisma/client";

export type NotifPayload = {
  type: NotificationType;
  actorName: string;
  actorAvatar: string | null;
  postId?: string | null;
};

export function emitNotification(userId: string, payload?: NotifPayload) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const io = (global as any)._io;
  if (io) io.to(`user:${userId}`).emit("new-notification", payload ?? null);
}
