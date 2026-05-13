"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/shared/Avatar";
import { VerifiedBadge } from "@/components/shared/VerifiedBadge";
import { MobilePageHeader } from "@/components/layout/MobilePageHeader";
import { ArrowLeft } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import type { ConversationWithMembers } from "@/types";
import { toast } from "sonner";
import { useState } from "react";

export default function MessageRequestsPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [actionId, setActionId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ data: ConversationWithMembers[] }>({
    queryKey: ["conversations"],
    queryFn: () => fetch("/api/messages").then((r) => r.json()),
  });

  const requests = (data?.data || []).filter(
    (c) => c.isRequest && c.requesterId !== user?.id
  );

  async function accept(convId: string) {
    setActionId(convId);
    try {
      const res = await fetch(`/api/messages/${convId}/accept`, { method: "POST" });
      if (!res.ok) throw new Error();
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      toast.success("Request accepted");
      router.push(`/messages/${convId}`);
    } catch {
      toast.error("Failed to accept");
    } finally {
      setActionId(null);
    }
  }

  async function decline(convId: string) {
    setActionId(convId + "-decline");
    try {
      const res = await fetch(`/api/messages/${convId}/decline`, { method: "POST" });
      if (!res.ok) throw new Error();
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      toast.success("Request declined");
    } catch {
      toast.error("Failed to decline");
    } finally {
      setActionId(null);
    }
  }

  return (
    <div>
<MobilePageHeader className="bg-[var(--background)]/80 backdrop-blur-md border-b border-[var(--border)] px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 rounded-full hover:bg-[var(--hover)]">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold">Message requests</h1>
      </MobilePageHeader>

      {isLoading && (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!isLoading && requests.length === 0 && (
        <p className="text-center text-[var(--muted)] py-16">No message requests.</p>
      )}

      <p className="px-4 py-3 text-sm text-[var(--muted)] border-b border-[var(--border)]">
        People who aren't in your contacts sent you a message. You can accept or decline.
      </p>

      {requests.map((conv) => {
        const other = conv.members.find((m) => m.id !== user?.id) || conv.members[0];
        const lastMsg = conv.lastMessage;
        const isAccepting = actionId === conv.id;
        const isDeclining = actionId === conv.id + "-decline";

        return (
          <div
            key={conv.id}
            className="flex items-start gap-3 px-4 py-4 border-b border-[var(--border)] hover:bg-[var(--hover)] cursor-pointer transition-colors"
            onClick={() => router.push(`/messages/${conv.id}`)}
          >
            <div className="flex-shrink-0 pt-0.5">
              <Avatar src={other?.avatarUrl} alt={other?.displayName || "User"} size="md" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 mb-0.5">
                <span className="font-bold text-sm">{other?.displayName}</span>
                {other?.verified && <VerifiedBadge size={13} />}
                <span className="text-[var(--muted)] text-xs ml-1">@{other?.username}</span>
                {lastMsg && (
                  <span className="text-[var(--muted)] text-xs ml-auto flex-shrink-0">
                    {formatRelativeTime(lastMsg.createdAt)}
                  </span>
                )}
              </div>
              {lastMsg && (
                <p className="text-sm text-[var(--muted)] truncate mb-2">
                  {lastMsg.content || "📎 Media"}
                </p>
              )}
              <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => accept(conv.id)}
                  disabled={isAccepting || isDeclining}
                  className="px-4 py-1.5 rounded-full bg-[var(--accent)] text-white text-xs font-bold disabled:opacity-50 transition-opacity"
                >
                  {isAccepting ? "…" : "Accept"}
                </button>
                <button
                  onClick={() => decline(conv.id)}
                  disabled={isAccepting || isDeclining}
                  className="px-4 py-1.5 rounded-full border border-[var(--border)] text-xs font-bold hover:bg-[var(--hover)] disabled:opacity-50 transition-colors"
                >
                  {isDeclining ? "…" : "Decline"}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
