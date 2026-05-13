"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, Search, Bookmark } from "lucide-react";
import { Avatar } from "@/components/shared/Avatar";
import { VerifiedBadge } from "@/components/shared/VerifiedBadge";
import { useAuthStore } from "@/store/authStore";
import type { SafeUser, ConversationWithMembers } from "@/types";

type Props = {
  title?: string;
  onClose: () => void;
  onSelect: (user: SafeUser | null, existingConvId: string | null, displayName?: string) => void;
  excludeConvIds?: string[];
  excludeUserIds?: string[];
  loadingId?: string | null;
  allowGroups?: boolean;
};

export function UserPickerSheet({
  title = "Send to",
  onClose,
  onSelect,
  excludeConvIds = [],
  excludeUserIds = [],
  loadingId,
  allowGroups = true,
}: Props) {
  const { user } = useAuthStore();
  const [query, setQuery] = useState("");

  const { data: convData } = useQuery<{ data: ConversationWithMembers[] }>({
    queryKey: ["conversations"],
    queryFn: () => fetch("/api/messages").then((r) => r.json()),
    staleTime: 30000,
  });

  const { data: blockedIdsData } = useQuery<{ data: string[] }>({
    queryKey: ["blocked-ids"],
    queryFn: () => fetch("/api/users/blocked?ids=true").then((r) => r.json()),
    enabled: !!user,
    staleTime: 60000,
  });
  const blockedIds = new Set(blockedIdsData?.data || []);
  const excludeUserSet = new Set(excludeUserIds);

  const allConversations = convData?.data || [];

  // Include both 1:1 and group conversations; filter out blocked users for 1:1
  const conversations = allConversations.filter((c) => {
    if (excludeConvIds.includes(c.id)) return false;
    if (c.isGroup && !allowGroups) return false;
    if (!c.isGroup) {
      const other = c.members.find((m) => m.id !== user?.id);
      if (other && blockedIds.has(other.id)) return false;
      if (other && excludeUserSet.has(other.id)) return false;
    }
    return true;
  });

  // Top contacts: first 6 non-self 1:1 conversations as quick-access avatars
  const topContacts = conversations
    .filter((c) => {
      if (c.isGroup) return false;
      const other = c.members.find((m) => m.id !== user?.id);
      return other && other.id !== user?.id;
    })
    .slice(0, 6);

  const { data: searchData, isLoading: searchLoading } = useQuery<{
    data: { users: SafeUser[] };
  }>({
    queryKey: ["picker-search", query],
    queryFn: () =>
      fetch(`/api/search?q=${encodeURIComponent(query)}&type=users&mutual=true`).then((r) =>
        r.json()
      ),
    enabled: query.length > 0,
    staleTime: 0,
  });

  const searchResults = (searchData?.data?.users || []).filter((u) => !excludeUserSet.has(u.id));

  function getExistingConvId(userId: string): string | null {
    return (
      allConversations.find(
        (c) => !c.isGroup && c.members.some((m) => m.id === userId)
      )?.id ?? null
    );
  }

  function handleConvClick(conv: ConversationWithMembers) {
    if (conv.isGroup) {
      onSelect(null, conv.id, conv.name ?? "Group");
      return;
    }
    const other = conv.members.find((m) => m.id !== user?.id) || conv.members[0];
    if (other) onSelect(other, conv.id);
  }

  function GroupAvatar({ conv }: { conv: ConversationWithMembers }) {
    if ((conv as { avatarUrl?: string | null }).avatarUrl) {
      return (
        <img
          src={(conv as { avatarUrl: string }).avatarUrl}
          alt={conv.name ?? "Group"}
          className="w-10 h-10 rounded-full object-cover flex-shrink-0"
        />
      );
    }
    return (
      <div className="w-10 h-10 rounded-full bg-[var(--accent)] flex items-center justify-center text-white font-bold flex-shrink-0">
        {(conv.name || "G").charAt(0)}
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-end lg:items-center justify-center pb-[calc(env(safe-area-inset-bottom)+64px)] lg:pb-0"
      onClick={onClose}
    >
      <div
        className="bg-[var(--background)] rounded-t-2xl lg:rounded-2xl w-full lg:max-w-sm shadow-2xl max-h-[75vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle on mobile */}
        <div className="lg:hidden flex justify-center pt-2.5 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-[var(--muted)]/30" />
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] flex-shrink-0">
          <button onClick={onClose} className="p-1 rounded-full hover:bg-[var(--hover)]">
            <X size={20} />
          </button>
          <h2 className="font-bold">{title}</h2>
        </div>

        {/* Search */}
        <div className="px-4 py-2.5 border-b border-[var(--border)] flex-shrink-0">
          <div className="flex items-center gap-2 bg-[var(--hover)] rounded-full px-3 py-2">
            <Search size={15} className="text-[var(--muted)] flex-shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search people"
              className="flex-1 bg-transparent outline-none text-sm"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="text-[var(--muted)] hover:text-[var(--foreground)]"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1 py-1">
          {query.length > 0 ? (
            <>
              {searchLoading && (
                <div className="flex justify-center py-6">
                  <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {!searchLoading && searchResults.length === 0 && (
                <p className="text-center text-[var(--muted)] text-sm py-8">
                  No people found
                </p>
              )}
              {searchResults.map((u) => (
                <button
                  key={u.id}
                  onClick={() => onSelect(u, getExistingConvId(u.id))}
                  disabled={loadingId === u.id}
                  className="flex items-center gap-3 w-full px-4 py-3 hover:bg-[var(--hover)] transition-colors disabled:opacity-60"
                >
                  <Avatar src={u.avatarUrl} alt={u.displayName} size="md" />
                  <div className="text-left flex-1 min-w-0">
                    <div className="flex items-center gap-1 font-bold text-sm">
                      {u.displayName}
                      {u.verified && <VerifiedBadge size={13} />}
                    </div>
                    <p className="text-[var(--muted)] text-xs">@{u.username}</p>
                  </div>
                  {loadingId === u.id && (
                    <div className="w-4 h-4 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin flex-shrink-0" />
                  )}
                </button>
              ))}
            </>
          ) : (
            <>
              {/* Top contacts — horizontal quick-access row (1:1 only) */}
              {topContacts.length > 0 && (
                <div className="px-4 pt-3 pb-2">
                  <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide mb-3">Frequent</p>
                  <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
                    {topContacts.map((conv) => {
                      const other = conv.members.find((m) => m.id !== user?.id)!;
                      const isLoading = loadingId === conv.id || loadingId === other.id;
                      return (
                        <button
                          key={conv.id}
                          onClick={() => handleConvClick(conv)}
                          disabled={isLoading}
                          className="flex flex-col items-center gap-1.5 flex-shrink-0 w-14 disabled:opacity-60"
                        >
                          <div className="relative">
                            <Avatar src={other.avatarUrl} alt={other.displayName} size="md" />
                            {isLoading && (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-full">
                                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-center leading-tight line-clamp-2 w-full">
                            {other.displayName.split(" ")[0]}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Divider before full list */}
              {topContacts.length > 0 && conversations.length > 0 && (
                <div className="px-4 pt-2 pb-1">
                  <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide">Recent</p>
                </div>
              )}

              {conversations.length === 0 && (
                <p className="text-center text-[var(--muted)] text-sm py-8">
                  No conversations yet
                </p>
              )}

              {conversations.map((conv) => {
                const other =
                  conv.members.find((m) => m.id !== user?.id) || conv.members[0];
                const isSelfConv = !conv.isGroup && other?.id === user?.id;
                return (
                  <button
                    key={conv.id}
                    onClick={() => handleConvClick(conv)}
                    disabled={loadingId === conv.id}
                    className="flex items-center gap-3 w-full px-4 py-3 hover:bg-[var(--hover)] transition-colors disabled:opacity-60"
                  >
                    {isSelfConv ? (
                      <div className="w-10 h-10 rounded-full bg-[var(--accent)]/15 flex items-center justify-center flex-shrink-0">
                        <Bookmark size={20} className="text-[var(--accent)]" />
                      </div>
                    ) : conv.isGroup ? (
                      <GroupAvatar conv={conv} />
                    ) : (
                      <Avatar
                        src={other?.avatarUrl}
                        alt={other?.displayName || "User"}
                        size="md"
                      />
                    )}
                    <div className="text-left flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {isSelfConv
                          ? "Saved Messages"
                          : conv.isGroup
                          ? conv.name
                          : other?.displayName}
                      </p>
                      {!isSelfConv && !conv.isGroup && (
                        <p className="text-[var(--muted)] text-xs">
                          @{other?.username}
                        </p>
                      )}
                      {conv.isGroup && (
                        <p className="text-[var(--muted)] text-xs">
                          {conv.members.length} members
                        </p>
                      )}
                    </div>
                    {loadingId === conv.id && (
                      <div className="w-4 h-4 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
