"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Avatar } from "@/components/shared/Avatar";
import { VerifiedBadge } from "@/components/shared/VerifiedBadge";
import Link from "next/link";
import { formatRelativeTime } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import type { ConversationWithMembers, SafeUser } from "@/types";
import { PenSquare, X, Bookmark, Search, MessageCircle, ChevronRight, Users, Check, Camera } from "lucide-react";
import { useState, useEffect, useRef, Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MobilePageHeader } from "@/components/layout/MobilePageHeader";

// ── New 1:1 Message Modal ────────────────────────────────────────────────────

function NewMessageModal({ initialUsername, onClose }: { initialUsername?: string; onClose: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState(initialUsername || "");
  const [recipient, setRecipient] = useState<SafeUser | null>(null);
  const [message, setMessage] = useState("");
  const [loadingUser, setLoadingUser] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const { data: searchResults } = useQuery<{ data: { users: SafeUser[] } }>({
    queryKey: ["userSearch", search],
    queryFn: () => fetch(`/api/search?q=${encodeURIComponent(search)}&type=users`).then((r) => r.json()),
    enabled: search.length > 0 && !recipient,
  });

  useEffect(() => {
    if (initialUsername) {
      setLoadingUser(true);
      fetch(`/api/users/${initialUsername}`)
        .then((r) => r.json())
        .then((d) => { if (d.data) setRecipient(d.data); })
        .finally(() => setLoadingUser(false));
    }
  }, [initialUsername]);

  const { mutate: sendDM, isPending } = useMutation({
    mutationFn: () =>
      fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId: recipient!.id, message }),
      }).then((r) => r.json()),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      router.push(`/messages/${data.data.conversation.id}`);
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end lg:items-center justify-center pb-[calc(env(safe-area-inset-bottom)+64px)] lg:pb-0 lg:p-4" onClick={onClose}>
      <div className="bg-[var(--background)] rounded-t-2xl lg:rounded-2xl w-full lg:max-w-lg shadow-2xl max-h-[75vh] lg:max-h-none flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="lg:hidden flex justify-center pt-2.5 pb-0.5">
          <div className="w-10 h-1 rounded-full bg-[var(--muted)]/30" />
        </div>

        <div className="flex items-center gap-4 px-4 py-3 border-b border-[var(--border)]">
          <button onClick={onClose} className="p-2 rounded-full hover:bg-[var(--hover)]">
            <X size={20} />
          </button>
          <h2 className="font-bold text-xl">New message</h2>
        </div>

        <div className="px-4 py-3 border-b border-[var(--border)] flex items-center gap-2 min-h-[52px]">
          <span className="text-[var(--muted)] text-sm font-medium flex-shrink-0">To:</span>
          {recipient ? (
            <div className="flex items-center gap-1.5 bg-[var(--accent)]/10 text-[var(--accent)] pl-1 pr-2 py-1 rounded-full text-sm font-semibold">
              <Avatar src={recipient.avatarUrl} alt={recipient.displayName} size="xs" />
              <span>{recipient.displayName}</span>
              <button onClick={() => { setRecipient(null); setSearch(""); }} className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity">
                <X size={13} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 flex-1">
              <Search size={14} className="text-[var(--muted)] flex-shrink-0" />
              <input
                ref={searchRef}
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search people"
                className="flex-1 outline-none bg-transparent text-sm"
              />
            </div>
          )}
        </div>

        {!recipient && search && (
          <div className="max-h-64 overflow-y-auto">
            {loadingUser && (
              <div className="flex justify-center py-4">
                <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {searchResults?.data?.users?.map((u) => (
              <button
                key={u.id}
                onClick={() => { setRecipient(u); setSearch(""); }}
                className="flex items-center gap-3 w-full px-4 py-3 hover:bg-[var(--hover)] transition-colors"
              >
                <Avatar src={u.avatarUrl} alt={u.displayName} size="md" />
                <div className="text-left">
                  <div className="flex items-center gap-1 font-bold text-sm">
                    {u.displayName}
                    {u.verified && <VerifiedBadge size={14} />}
                  </div>
                  <p className="text-[var(--muted)] text-sm">@{u.username}</p>
                </div>
              </button>
            ))}
            {searchResults?.data?.users?.length === 0 && (
              <p className="text-center text-[var(--muted)] text-sm py-6">No people found</p>
            )}
          </div>
        )}

        {recipient && (
          <div className="flex flex-col">
            <div className="flex flex-col items-center gap-3 py-6 px-4 border-b border-[var(--border)]">
              <Avatar src={recipient.avatarUrl} alt={recipient.displayName} size="lg" />
              <div className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <p className="font-bold">{recipient.displayName}</p>
                  {recipient.verified && <VerifiedBadge size={15} />}
                </div>
                <p className="text-[var(--muted)] text-sm">@{recipient.username}</p>
              </div>
            </div>
            <div className="p-4 space-y-3">
              <textarea
                autoFocus
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={`Message ${recipient.displayName}`}
                rows={4}
                className="w-full bg-[var(--hover)] rounded-xl px-4 py-3 text-sm outline-none resize-none"
              />
              <div className="flex justify-end">
                <button
                  onClick={() => sendDM()}
                  disabled={!message.trim() || isPending}
                  className="px-5 py-2 rounded-full bg-[var(--accent)] text-white font-bold text-sm disabled:opacity-50 transition-opacity"
                >
                  {isPending ? "Sending…" : "Send"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── New Group Modal ──────────────────────────────────────────────────────────

function NewGroupModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<SafeUser[]>([]);
  const [groupName, setGroupName] = useState("");
  const [groupAvatar, setGroupAvatar] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [step, setStep] = useState<"pick" | "name">("pick");
  const [creating, setCreating] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const { data: searchResults } = useQuery<{ data: { users: SafeUser[] } }>({
    queryKey: ["groupSearch", search],
    queryFn: () => fetch(`/api/search?q=${encodeURIComponent(search)}&type=users`).then((r) => r.json()),
    enabled: search.length > 0,
    staleTime: 0,
  });

  const users = searchResults?.data?.users || [];

  function toggle(u: SafeUser) {
    setSelected((prev) =>
      prev.some((p) => p.id === u.id) ? prev.filter((p) => p.id !== u.id) : [...prev, u]
    );
  }

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("context", "avatar");
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const d = await res.json();
      if (res.ok) setGroupAvatar(d.data.url);
    } finally {
      setUploadingPhoto(false);
      e.target.value = "";
    }
  }

  async function createGroup() {
    if (selected.length < 2 || !groupName.trim() || creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientIds: selected.map((u) => u.id),
          name: groupName.trim(),
          ...(groupAvatar ? { avatarUrl: groupAvatar } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) return;
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      router.push(`/messages/${data.data.conversation.id}`);
      onClose();
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end lg:items-center justify-center pb-[calc(env(safe-area-inset-bottom)+64px)] lg:pb-0 lg:p-4" onClick={onClose}>
      <div className="bg-[var(--background)] rounded-t-2xl lg:rounded-2xl w-full lg:max-w-lg shadow-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="lg:hidden flex justify-center pt-2.5 pb-0.5 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-[var(--muted)]/30" />
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] flex-shrink-0">
          <button onClick={step === "name" ? () => setStep("pick") : onClose} className="p-2 rounded-full hover:bg-[var(--hover)]">
            <X size={20} />
          </button>
          <h2 className="font-bold text-xl flex-1">
            {step === "pick" ? "New group" : "Group name"}
          </h2>
          {step === "pick" && selected.length >= 2 && (
            <button
              onClick={() => setStep("name")}
              className="px-4 py-1.5 rounded-full bg-[var(--accent)] text-white font-bold text-sm"
            >
              Next
            </button>
          )}
        </div>

        {step === "pick" && (
          <>
            {/* Selected chips */}
            {selected.length > 0 && (
              <div className="flex gap-2 flex-wrap px-4 py-2 border-b border-[var(--border)] flex-shrink-0">
                {selected.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => toggle(u)}
                    className="flex items-center gap-1.5 bg-[var(--accent)]/10 text-[var(--accent)] pl-1 pr-2 py-1 rounded-full text-xs font-semibold"
                  >
                    <Avatar src={u.avatarUrl} alt={u.displayName} size="xs" />
                    {u.displayName}
                    <X size={11} className="opacity-70" />
                  </button>
                ))}
              </div>
            )}

            {/* Search */}
            <div className="px-4 py-2.5 border-b border-[var(--border)] flex-shrink-0">
              <div className="flex items-center gap-2 bg-[var(--hover)] rounded-full px-3 py-2">
                <Search size={15} className="text-[var(--muted)] flex-shrink-0" />
                <input
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search people"
                  className="flex-1 bg-transparent outline-none text-sm"
                />
              </div>
            </div>

            {/* Results */}
            <div className="overflow-y-auto flex-1">
              {users.length === 0 && search.length > 0 && (
                <p className="text-center text-[var(--muted)] text-sm py-8">No people found</p>
              )}
              {users.length === 0 && search.length === 0 && (
                <p className="text-center text-[var(--muted)] text-sm py-8">Search for people to add</p>
              )}
              {users.map((u) => {
                const isSelected = selected.some((p) => p.id === u.id);
                return (
                  <button
                    key={u.id}
                    onClick={() => toggle(u)}
                    className="flex items-center gap-3 w-full px-4 py-3 hover:bg-[var(--hover)] transition-colors"
                  >
                    <Avatar src={u.avatarUrl} alt={u.displayName} size="md" />
                    <div className="text-left flex-1 min-w-0">
                      <div className="flex items-center gap-1 font-bold text-sm">
                        {u.displayName}
                        {u.verified && <VerifiedBadge size={13} />}
                      </div>
                      <p className="text-[var(--muted)] text-xs">@{u.username}</p>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? "bg-[var(--accent)] border-[var(--accent)]" : "border-[var(--muted)]"}`}>
                      {isSelected && <Check size={12} className="text-white" />}
                    </div>
                  </button>
                );
              })}
            </div>

            {selected.length > 0 && selected.length < 2 && (
              <p className="text-center text-xs text-[var(--muted)] py-3 flex-shrink-0">Add at least 2 people to create a group</p>
            )}
          </>
        )}

        {step === "name" && (
          <div className="flex flex-col flex-1 p-6 gap-5 overflow-y-auto">
            {/* Group photo + name row */}
            <div className="flex items-center gap-4">
              {/* Photo picker */}
              <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="relative w-16 h-16 rounded-full flex-shrink-0 overflow-hidden bg-[var(--hover)] flex items-center justify-center hover:opacity-90 transition-opacity"
              >
                {groupAvatar ? (
                  <img src={groupAvatar} alt="Group photo" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-[var(--accent)] flex items-center justify-center text-white font-bold text-xl">
                    {groupName ? groupName.charAt(0).toUpperCase() : "G"}
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  {uploadingPhoto
                    ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <Camera size={18} className="text-white" />
                  }
                </div>
              </button>

              {/* Name input */}
              <input
                autoFocus
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && groupName.trim()) createGroup(); }}
                placeholder="Group name…"
                className="flex-1 px-4 py-3 rounded-2xl bg-[var(--hover)] outline-none text-base"
                maxLength={60}
              />
            </div>

            {/* Member preview */}
            <div className="flex gap-2 flex-wrap">
              {selected.map((u) => (
                <div key={u.id} className="flex flex-col items-center gap-1 w-14">
                  <Avatar src={u.avatarUrl} alt={u.displayName} size="md" />
                  <p className="text-xs text-center line-clamp-1 w-full">{u.displayName.split(" ")[0]}</p>
                </div>
              ))}
            </div>

            <button
              onClick={createGroup}
              disabled={!groupName.trim() || creating}
              className="w-full py-3 rounded-full bg-[var(--accent)] text-white font-bold disabled:opacity-50 transition-opacity"
            >
              {creating ? "Creating…" : `Create group · ${selected.length + 1} members`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Conversation Row ─────────────────────────────────────────────────────────

function ConversationRow({ conv, userId, onClick }: { conv: ConversationWithMembers; userId: string; onClick: () => void }) {
  const other = conv.members.find((m) => m.id !== userId) || conv.members[0];
  const isSelfConv = !conv.isGroup && other?.id === userId;
  const lastMsg = conv.lastMessage;
  const isUnread = conv.unreadCount > 0;
  const router = useRouter();

  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-4 hover:bg-[var(--hover)] border-b border-[var(--border)] transition-colors cursor-pointer ${isUnread ? "bg-[var(--accent)]/5" : ""}`}
    >
      <div
        className="relative flex-shrink-0"
        onClick={(e) => {
          if (isSelfConv || conv.isGroup) return;
          e.stopPropagation();
          router.push(`/${other?.username}`);
        }}
      >
        {isSelfConv ? (
          <div className="w-10 h-10 rounded-full bg-[var(--accent)]/15 flex items-center justify-center">
            <Bookmark size={20} className="text-[var(--accent)]" />
          </div>
        ) : conv.isGroup ? (
          conv.avatarUrl ? (
            <img src={conv.avatarUrl} alt={conv.name || "Group"} className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-[var(--accent)] flex items-center justify-center text-white font-bold">
              {(conv.name || "G").charAt(0).toUpperCase()}
            </div>
          )
        ) : (
          <div className="hover:opacity-80 transition-opacity">
            <Avatar src={other?.avatarUrl} alt={other?.displayName || "User"} size="md" />
          </div>
        )}
        {isUnread && (
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[var(--accent)] rounded-full border-2 border-[var(--background)]" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className={`truncate ${isUnread ? "font-bold" : "font-medium"}`}>
              {isSelfConv ? "Saved Messages" : conv.isGroup ? conv.name : other?.displayName}
            </span>
            {!conv.isGroup && !isSelfConv && other?.verified && <VerifiedBadge size={14} />}
          </div>
          {lastMsg && (
            <span className={`text-xs flex-shrink-0 ${isUnread ? "text-[var(--accent)] font-semibold" : "text-[var(--muted)]"}`}>
              {formatRelativeTime(lastMsg.createdAt)}
            </span>
          )}
        </div>
        {!conv.isGroup && !isSelfConv && <p className="text-[var(--muted)] text-sm">@{other?.username}</p>}
        {isSelfConv && <p className="text-[var(--muted)] text-sm">Only visible to you</p>}
        {conv.isGroup && (
          <p className="text-[var(--muted)] text-xs">{conv.members.length} members</p>
        )}
        {lastMsg && (
          <p className={`text-sm truncate ${isUnread ? "text-[var(--foreground)] font-medium" : "text-[var(--muted)]"}`}>
            {lastMsg.sender?.username === conv.members.find((m) => m.id === userId)?.username ? "You: " : ""}
            {lastMsg.content || "📎 Media"}
          </p>
        )}
      </div>
      {isUnread && (
        <span className="w-2 h-2 rounded-full bg-[var(--accent)] flex-shrink-0" />
      )}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

function MessagesContent() {
  const { user } = useAuthStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const dmUsername = searchParams.get("dm");
  const [showCompose, setShowCompose] = useState(!!dmUsername);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (dmUsername) setShowCompose(true);
  }, [dmUsername]);

  const { data, isLoading } = useQuery<{ data: ConversationWithMembers[] }>({
    queryKey: ["conversations"],
    queryFn: () => fetch("/api/messages").then((r) => r.json()),
  });

  const all = data?.data || [];

  // Split inbox (active + sent requests) from received requests
  const inbox = all.filter((c) => !c.isRequest || c.requesterId === user?.id);
  const requests = all.filter((c) => c.isRequest && c.requesterId !== user?.id);

  // Filter by search query
  const q = searchQuery.trim().toLowerCase();
  const filteredInbox = q
    ? inbox.filter((c) => {
        if (c.isGroup) return (c.name ?? "").toLowerCase().includes(q);
        const other = c.members.find((m) => m.id !== user?.id) || c.members[0];
        return (
          other?.displayName?.toLowerCase().includes(q) ||
          other?.username?.toLowerCase().includes(q)
        );
      })
    : inbox;

  const closeCompose = useCallback(() => setShowCompose(false), []);
  const closeNewGroup = useCallback(() => setShowNewGroup(false), []);

  return (
    <div>
      <MobilePageHeader className="bg-[var(--background)]/80 backdrop-blur-md border-b border-[var(--border)] px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-bold">Messages</h1>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowNewGroup(true)} className="p-2 rounded-full hover:bg-[var(--hover)]" aria-label="New group">
            <Users size={20} />
          </button>
          <button onClick={() => setShowCompose(true)} className="p-2 rounded-full hover:bg-[var(--hover)]" aria-label="New message">
            <PenSquare size={20} />
          </button>
        </div>
      </MobilePageHeader>

      {/* Search bar */}
      <div className="px-4 py-2.5 border-b border-[var(--border)] bg-[var(--background)]">
        <div className="flex items-center gap-2 bg-[var(--hover)] rounded-full px-3 py-2">
          <Search size={15} className="text-[var(--muted)] flex-shrink-0" />
          <input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations"
            className="flex-1 bg-transparent outline-none text-sm"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="text-[var(--muted)] hover:text-[var(--foreground)]">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {isLoading && (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Message Requests — only when not searching */}
      {!q && requests.length > 0 && (
        <Link
          href="/messages/requests"
          className="flex items-center gap-3 px-4 py-4 hover:bg-[var(--hover)] border-b border-[var(--border)] transition-colors"
        >
          <div className="w-10 h-10 rounded-full bg-[var(--accent)]/15 flex items-center justify-center flex-shrink-0">
            <MessageCircle size={20} className="text-[var(--accent)]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">Message requests</p>
            <p className="text-[var(--muted)] text-sm">
              {requests.length} {requests.length === 1 ? "request" : "requests"} pending
            </p>
          </div>
          <ChevronRight size={18} className="text-[var(--muted)]" />
        </Link>
      )}

      {filteredInbox.map((conv) => (
        <ConversationRow
          key={conv.id}
          conv={conv}
          userId={user?.id || ""}
          onClick={() => router.push(`/messages/${conv.id}`)}
        />
      ))}

      {!isLoading && q && filteredInbox.length === 0 && (
        <p className="text-center text-[var(--muted)] text-sm py-10">No conversations found</p>
      )}

      {!isLoading && !q && inbox.length === 0 && requests.length === 0 && (
        <div className="text-center py-16">
          <h2 className="text-2xl font-bold mb-2">Welcome to your inbox!</h2>
          <p className="text-[var(--muted)] mb-4">Drop a message to start a private conversation.</p>
          <button
            onClick={() => setShowCompose(true)}
            className="px-5 py-2 rounded-full bg-[var(--accent)] text-white font-bold text-sm"
          >
            New message
          </button>
        </div>
      )}

      {showCompose && (
        <NewMessageModal
          initialUsername={dmUsername || undefined}
          onClose={closeCompose}
        />
      )}
      {showNewGroup && <NewGroupModal onClose={closeNewGroup} />}
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" /></div>}>
      <MessagesContent />
    </Suspense>
  );
}
