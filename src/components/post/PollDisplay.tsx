"use client";

import { useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { formatRelativeTime } from "@/lib/utils";
import type { PollWithOptions } from "@/types";
import { toast } from "sonner";

type PollDisplayProps = {
  poll: PollWithOptions;
  postId: string;
};

export function PollDisplay({ poll, postId }: PollDisplayProps) {
  const { user } = useAuthStore();
  const [localPoll, setLocalPoll] = useState(poll);
  const [voting, setVoting] = useState(false);

  const expired = new Date(localPoll.expiresAt) < new Date();
  const hasVoted = !!localPoll.userVoteId;
  const showResults = hasVoted || expired;
  const totalVotes = localPoll.options.reduce((sum, o) => sum + o.votesCount, 0);

  async function handleVote(optionId: string) {
    if (!user) return toast.error("Sign in to vote");
    if (expired || voting) return;
    if (localPoll.userVoteId === optionId) return;

    setVoting(true);
    try {
      const res = await fetch(`/api/polls/${localPoll.id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setLocalPoll((p) => ({ ...p, ...data.data, userVoteId: optionId }));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to vote");
    } finally {
      setVoting(false);
    }
  }

  return (
    <div className="mt-3 space-y-2">
      {localPoll.options.map((option) => {
        const pct = totalVotes > 0 ? Math.round((option.votesCount / totalVotes) * 100) : 0;
        const isVoted = localPoll.userVoteId === option.id;

        const isCurrentVote = isVoted;
        const canClick = !expired && !voting && !isCurrentVote;

        return (
          <button
            key={option.id}
            onClick={() => handleVote(option.id)}
            disabled={expired || voting || isCurrentVote}
            className={`w-full text-left relative rounded-full border border-[var(--border)] overflow-hidden h-10 ${canClick ? "hover:border-[var(--accent)] cursor-pointer" : "cursor-default"}`}
          >
            {showResults && (
              <div
                className={`absolute inset-y-0 left-0 ${isVoted ? "bg-[var(--accent)]" : "bg-[var(--border)]"} transition-all`}
                style={{ width: `${pct}%` }}
              />
            )}
            <div className="relative flex items-center justify-between px-4 h-full">
              <span className="font-medium text-sm">{option.text}</span>
              {showResults && (
                <span className="text-sm font-bold">{pct}%</span>
              )}
            </div>
          </button>
        );
      })}
      <p className="text-[var(--muted)] text-xs">
        {totalVotes.toLocaleString()} votes ·{" "}
        {expired ? "Final results" : `Ends ${formatRelativeTime(localPoll.expiresAt)}`}
      </p>
    </div>
  );
}
