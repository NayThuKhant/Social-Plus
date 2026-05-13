"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/shared/Avatar";
import { VerifiedBadge } from "@/components/shared/VerifiedBadge";
import { MobilePageHeader } from "@/components/layout/MobilePageHeader";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import type { SafeUser } from "@/types";
import { useConfirm } from "@/components/shared/ConfirmDialog";

export default function BlockedPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const confirm = useConfirm((s) => s.show);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ data: SafeUser[] }>({
    queryKey: ["blocked-users"],
    queryFn: () => fetch("/api/users/blocked").then((r) => r.json()),
  });

  const blocked = data?.data || [];

  async function unblock(username: string, userId: string) {
    const ok = await confirm({
      title: `Unblock @${username}?`,
      message: "They will be able to see your posts and interact with you again.",
      confirmLabel: "Unblock",
    });
    if (!ok) return;
    setUnblockingId(userId);
    try {
      const res = await fetch(`/api/users/${username}/block`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to unblock");
      queryClient.invalidateQueries({ queryKey: ["blocked-users"] });
      toast.success(`Unblocked @${username}`);
    } catch {
      toast.error("Failed to unblock");
    } finally {
      setUnblockingId(null);
    }
  }

  return (
    <div>
<MobilePageHeader className="bg-[var(--background)]/80 backdrop-blur-md border-b border-[var(--border)] px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="p-1 rounded-full hover:bg-[var(--hover)]">
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-xl font-bold">Blocked accounts</h1>
      </MobilePageHeader>

      {isLoading && (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!isLoading && blocked.length === 0 && (
        <div className="text-center py-16 px-4">
          <p className="text-[var(--muted)]">You haven&apos;t blocked anyone.</p>
        </div>
      )}

      <div className="divide-y divide-[var(--border)]">
        {blocked.map((u) => (
          <div key={u.id} className="flex items-center gap-3 px-4 py-4">
            <button onClick={() => router.push(`/${u.username}`)} className="flex-shrink-0">
              <Avatar src={u.avatarUrl} alt={u.displayName} size="md" />
            </button>
            <div className="flex-1 min-w-0">
              <button onClick={() => router.push(`/${u.username}`)} className="text-left">
                <div className="flex items-center gap-1">
                  <span className="font-bold text-sm truncate">{u.displayName}</span>
                  {u.verified && <VerifiedBadge size={13} />}
                </div>
                <p className="text-[var(--muted)] text-sm">@{u.username}</p>
              </button>
            </div>
            <button
              onClick={() => unblock(u.username, u.id)}
              disabled={unblockingId === u.id}
              className="flex-shrink-0 px-4 py-1.5 rounded-full border border-[var(--border)] text-sm font-bold hover:bg-[var(--hover)] transition-colors disabled:opacity-50"
            >
              {unblockingId === u.id ? "…" : "Unblock"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
