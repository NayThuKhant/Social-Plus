"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import {
  ArrowLeft, Image as ImageIcon, Link2, Trash2, ShieldOff, Shield,
  Pencil, Check, X, UserPlus, UserMinus, LogOut, Camera, Crown,
} from "lucide-react";

import { Avatar } from "@/components/shared/Avatar";
import { VerifiedBadge } from "@/components/shared/VerifiedBadge";
import { useAuthStore } from "@/store/authStore";
import { useConfirm } from "@/components/shared/ConfirmDialog";
import { UserPickerSheet } from "@/components/messages/UserPickerSheet";
import type { ConversationWithMembers, SafeUser } from "@/types";
import Link from "next/link";
import { format } from "date-fns";
import { toast } from "sonner";

type MediaMessage = { id: string; mediaUrls: string[]; createdAt: string };
type LinkEntry = { url: string; messageId: string; createdAt: string; sender: { displayName: string; avatarUrl: string | null } };
type Tab = "media" | "links";

// ── Main info page ───────────────────────────────────────────────────────────

export default function ConversationInfoPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const confirm = useConfirm((s) => s.show);
  const [tab, setTab] = useState<Tab>("media");
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [showAddMember, setShowAddMember] = useState(false);
  const [addingMemberId, setAddingMemberId] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const { data: convData, refetch: refetchConv } = useQuery<{ data: ConversationWithMembers }>({
    queryKey: ["conversation", conversationId],
    queryFn: () => fetch(`/api/messages/${conversationId}`).then((r) => r.json()),
  });
  const conversation = convData?.data;
  const other = conversation?.members.find((m) => m.id !== user?.id) || conversation?.members[0];
  const isSelf = !!other && other.id === user?.id;
  const isGroup = conversation?.isGroup ?? false;
  // requesterId doubles as creatorId for groups
  const isCreator = isGroup && conversation?.requesterId === user?.id;

  const { data: infoData } = useQuery<{ data: { mediaMessages: MediaMessage[]; links: LinkEntry[] } }>({
    queryKey: ["conversation-info", conversationId],
    queryFn: () => fetch(`/api/messages/${conversationId}/info`).then((r) => r.json()),
  });
  const mediaMessages = infoData?.data?.mediaMessages ?? [];
  const links = infoData?.data?.links ?? [];

  // 1:1 block status
  const { data: blockData, refetch: refetchBlock } = useQuery<{ data: { blocked: boolean } }>({
    queryKey: ["block", other?.username],
    queryFn: () => fetch(`/api/users/${other?.username}/block`).then((r) => r.json()),
    enabled: !!other?.username && !isSelf && !isGroup,
  });
  const isBlocked = blockData?.data?.blocked ?? false;

  const { mutate: toggleBlock, isPending: blockPending } = useMutation({
    mutationFn: () => fetch(`/api/users/${other!.username}/block`, { method: "POST" }).then((r) => r.json()),
    onSuccess: () => { refetchBlock(); },
  });

  // ── Group actions ────────────────────────────────────────────────────────

  async function saveName() {
    if (!nameInput.trim()) { setEditingName(false); return; }
    const res = await fetch(`/api/messages/${conversationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nameInput.trim() }),
    });
    if (res.ok) {
      queryClient.setQueryData(["conversation", conversationId], (old: { data: ConversationWithMembers } | undefined) =>
        old ? { ...old, data: { ...old.data, name: nameInput.trim() } } : old
      );
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    }
    setEditingName(false);
  }

  async function uploadAvatar(file: File) {
    setUploadingAvatar(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("context", "avatar");
      const up = await fetch("/api/upload", { method: "POST", body: form });
      const upData = await up.json();
      if (!up.ok) { toast.error("Upload failed"); return; }
      await fetch(`/api/messages/${conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: upData.data.url }),
      });
      refetchConv();
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      toast.success("Group photo updated");
    } catch {
      toast.error("Failed to update photo");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function removeMember(memberId: string, memberName: string) {
    const ok = await confirm({
      title: `Remove ${memberName}?`,
      message: "They will no longer be able to see or send messages in this group.",
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) return;
    const res = await fetch(`/api/messages/${conversationId}/members`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: memberId }),
    });
    if (res.ok) {
      queryClient.setQueryData(["conversation", conversationId], (old: { data: ConversationWithMembers } | undefined) =>
        old ? { ...old, data: { ...old.data, members: old.data.members.filter((m) => m.id !== memberId) } } : old
      );
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    }
  }

  async function leaveGroup() {
    const ok = await confirm({
      title: "Leave group?",
      message: "You'll no longer receive messages from this group.",
      confirmLabel: "Leave",
      danger: true,
    });
    if (!ok) return;
    const res = await fetch(`/api/messages/${conversationId}/leave`, { method: "POST" });
    if (res.ok) {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      router.replace("/messages");
    }
  }

  // ── 1:1 / Saved messages actions ─────────────────────────────────────────

  async function handleClear(scope: "me" | "all") {
    const ok = await confirm({
      title: "Clear messages?",
      message: scope === "all"
        ? "This will permanently delete all messages in this conversation for everyone."
        : "This will hide all messages in this conversation from your view.",
      confirmLabel: scope === "all" ? "Clear for everyone" : "Clear for me",
      danger: true,
    });
    if (!ok) return;
    await fetch(`/api/messages/${conversationId}/clear`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope }),
    });
    queryClient.removeQueries({ queryKey: ["messages", conversationId] });
    router.push("/messages");
  }

  async function handleBlock() {
    if (!other) return;
    const ok = await confirm({
      title: isBlocked ? `Unblock @${other.username}?` : `Block @${other.username}?`,
      message: isBlocked
        ? "They will be able to see your profile and message you again."
        : "They won't be able to send you messages or see your content.",
      confirmLabel: isBlocked ? "Unblock" : "Block",
      danger: !isBlocked,
    });
    if (!ok) return;
    toggleBlock();
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-10 flex flex-col bg-[var(--background)] lg:static lg:h-screen">
      {/* Header */}
      <div className="flex-shrink-0 bg-[var(--background)]/90 backdrop-blur-md border-b border-[var(--border)] px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 rounded-full hover:bg-[var(--hover)]">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-bold text-lg">{isGroup ? "Group Info" : "Conversation Info"}</h1>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* ── Group header ── */}
        {isGroup && conversation && (
          <div className="flex flex-col items-center py-6 px-4 border-b border-[var(--border)]">
            {/* Avatar with camera overlay */}
            <div className="relative">
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); e.target.value = ""; }}
              />
              <button
                onClick={() => avatarInputRef.current?.click()}
                className="relative group"
                disabled={uploadingAvatar}
              >
                {(conversation as { avatarUrl?: string | null }).avatarUrl ? (
                  <img src={(conversation as { avatarUrl: string }).avatarUrl} alt={conversation.name || "Group"} className="w-20 h-20 rounded-full object-cover" />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-[var(--accent)] flex items-center justify-center text-white font-bold text-3xl">
                    {(conversation.name || "G").charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  {uploadingAvatar
                    ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <Camera size={20} className="text-white" />
                  }
                </div>
              </button>
            </div>

            {/* Editable name */}
            <div className="mt-3 flex items-center gap-2">
              {editingName ? (
                <>
                  <input
                    autoFocus
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditingName(false); }}
                    className="font-bold text-xl bg-transparent border-b-2 border-[var(--accent)] outline-none text-center"
                    maxLength={60}
                  />
                  <button onClick={saveName} className="p-1 rounded-full hover:bg-[var(--hover)] text-[var(--accent)]"><Check size={16} /></button>
                  <button onClick={() => setEditingName(false)} className="p-1 rounded-full hover:bg-[var(--hover)] text-[var(--muted)]"><X size={16} /></button>
                </>
              ) : (
                <>
                  <span className="font-bold text-xl">{conversation.name}</span>
                  <button
                    onClick={() => { setNameInput(conversation.name || ""); setEditingName(true); }}
                    className="p-1 rounded-full hover:bg-[var(--hover)] text-[var(--muted)]"
                  >
                    <Pencil size={14} />
                  </button>
                </>
              )}
            </div>
            <p className="text-[var(--muted)] text-sm mt-0.5">{conversation.members.length} members</p>
          </div>
        )}

        {/* ── 1:1 profile header ── */}
        {!isGroup && other && !isSelf && (
          <div className="flex flex-col items-center py-6 px-4 border-b border-[var(--border)]">
            <Avatar src={other.avatarUrl} alt={other.displayName} size="xl" />
            <div className="mt-3 flex items-center gap-1.5">
              <span className="font-bold text-xl">{other.displayName}</span>
              {other.verified && <VerifiedBadge size={18} />}
            </div>
            <span className="text-[var(--muted)] text-sm mt-0.5">@{other.username}</span>
            <Link
              href={`/${other.username}`}
              className="mt-3 px-5 py-1.5 rounded-full border border-[var(--border)] text-sm font-semibold hover:bg-[var(--hover)] transition-colors"
            >
              View profile
            </Link>
          </div>
        )}

        {/* ── Group members ── */}
        {isGroup && conversation && (
          <div className="py-2 border-b border-[var(--border)]">
            <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide px-4 pt-2 pb-1">
              Members · {conversation.members.length}
            </p>
            {conversation.members.map((m) => {
              const isMe = m.id === user?.id;
              const isMemberCreator = m.id === conversation.requesterId;
              return (
                <div key={m.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--hover)] transition-colors">
                  <Avatar src={m.avatarUrl} alt={m.displayName} username={m.username} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-sm truncate">{m.displayName}</span>
                      {m.verified && <VerifiedBadge size={13} />}
                      {isMemberCreator && (
                        <span className="flex items-center gap-0.5 text-[10px] font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded-full">
                          <Crown size={9} /> Admin
                        </span>
                      )}
                      {isMe && <span className="text-[10px] text-[var(--muted)] font-medium">(you)</span>}
                    </div>
                    <p className="text-[var(--muted)] text-xs">@{m.username}</p>
                  </div>
                  {/* Creator can remove others (not themselves) */}
                  {isCreator && !isMe && (
                    <button
                      onClick={() => removeMember(m.id, m.displayName)}
                      className="p-2 rounded-full hover:bg-red-500/10 text-[var(--muted)] hover:text-red-500 transition-colors"
                      aria-label={`Remove ${m.displayName}`}
                    >
                      <UserMinus size={16} />
                    </button>
                  )}
                </div>
              );
            })}

            {/* Add people */}
            <button
              onClick={() => setShowAddMember(true)}
              className="flex items-center gap-3 w-full px-4 py-3 hover:bg-[var(--hover)] transition-colors text-[var(--accent)]"
            >
              <div className="w-10 h-10 rounded-full border-2 border-dashed border-[var(--accent)]/40 flex items-center justify-center flex-shrink-0">
                <UserPlus size={18} />
              </div>
              <span className="font-semibold text-sm">Add people</span>
            </button>
          </div>
        )}

        {/* ── Actions ── */}
        <div className="py-2 border-b border-[var(--border)]">
          <button
            onClick={() => handleClear("me")}
            className="flex items-center gap-3 w-full px-4 py-3.5 hover:bg-[var(--hover)] transition-colors text-sm"
          >
            <Trash2 size={18} className="text-[var(--muted)]" />
            <div className="text-left">
              <p className="font-medium">Clear messages for me</p>
              <p className="text-xs text-[var(--muted)]">Hides all messages from your view only</p>
            </div>
          </button>

          {(!isGroup || isCreator) && (
            <button
              onClick={() => handleClear("all")}
              className="flex items-center gap-3 w-full px-4 py-3.5 hover:bg-[var(--hover)] transition-colors text-sm border-t border-[var(--border)]"
            >
              <Trash2 size={18} className="text-red-500" />
              <div className="text-left">
                <p className="font-medium text-red-500">Clear conversation for everyone</p>
                <p className="text-xs text-[var(--muted)]">Permanently removes all messages for all members</p>
              </div>
            </button>
          )}

          {/* 1:1: block/unblock */}
          {!isSelf && !isGroup && other && (
            <button
              onClick={handleBlock}
              disabled={blockPending}
              className="flex items-center gap-3 w-full px-4 py-3.5 hover:bg-[var(--hover)] transition-colors text-sm border-t border-[var(--border)] disabled:opacity-60"
            >
              {isBlocked
                ? <Shield size={18} className="text-[var(--accent)]" />
                : <ShieldOff size={18} className="text-red-500" />
              }
              <div className="text-left">
                <p className={`font-medium ${isBlocked ? "text-[var(--accent)]" : "text-red-500"}`}>
                  {isBlocked ? `Unblock @${other.username}` : `Block @${other.username}`}
                </p>
                <p className="text-xs text-[var(--muted)]">
                  {isBlocked ? "Allow them to message you again" : "Prevent them from messaging you"}
                </p>
              </div>
            </button>
          )}

          {/* Group: leave */}
          {isGroup && (
            <button
              onClick={leaveGroup}
              className="flex items-center gap-3 w-full px-4 py-3.5 hover:bg-[var(--hover)] transition-colors text-sm border-t border-[var(--border)]"
            >
              <LogOut size={18} className="text-red-500" />
              <div className="text-left">
                <p className="font-medium text-red-500">Leave group</p>
                <p className="text-xs text-[var(--muted)]">You won&apos;t receive messages from this group</p>
              </div>
            </button>
          )}
        </div>

        {/* ── Media / Links tabs ── */}
        <div className="flex border-b border-[var(--border)]">
          <button
            onClick={() => setTab("media")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold border-b-2 transition-colors ${tab === "media" ? "border-[var(--accent)] text-[var(--accent)]" : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"}`}
          >
            <ImageIcon size={16} /> Media
          </button>
          <button
            onClick={() => setTab("links")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold border-b-2 transition-colors ${tab === "links" ? "border-[var(--accent)] text-[var(--accent)]" : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"}`}
          >
            <Link2 size={16} /> Links
          </button>
        </div>

        {tab === "media" && (
          <div className="p-3">
            {mediaMessages.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-[var(--muted)]">
                <ImageIcon size={32} className="mb-2 opacity-40" />
                <p className="text-sm">No media shared yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1">
                {mediaMessages.flatMap((m) =>
                  m.mediaUrls.map((url, i) => {
                    const isVideo = /\.(mp4|mov|webm|ogg)(\?|$)/i.test(url);
                    return isVideo
                      ? <video key={`${m.id}-${i}`} src={url} className="w-full aspect-square object-cover rounded-lg" muted />
                      : <img key={`${m.id}-${i}`} src={url} alt="" className="w-full aspect-square object-cover rounded-lg" />;
                  })
                )}
              </div>
            )}
          </div>
        )}

        {tab === "links" && (
          <div className="divide-y divide-[var(--border)]">
            {links.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-[var(--muted)]">
                <Link2 size={32} className="mb-2 opacity-40" />
                <p className="text-sm">No links shared yet</p>
              </div>
            ) : (
              links.map((l, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--hover)] flex items-center justify-center mt-0.5">
                    <Link2 size={14} className="text-[var(--accent)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <a
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--accent)] text-sm hover:underline break-all line-clamp-1"
                    >
                      {l.url}
                    </a>
                    <p className="text-xs text-[var(--muted)] mt-0.5">
                      {l.sender.displayName} · {format(new Date(l.createdAt), "MMM d, yyyy")}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {showAddMember && conversation && (
        <UserPickerSheet
          title="Add people"
          onClose={() => setShowAddMember(false)}
          loadingId={addingMemberId}
          excludeUserIds={conversation.members.map((m) => m.id)}
          allowGroups={false}
          onSelect={async (u) => {
            if (!u) return;
            if (conversation.members.some((m) => m.id === u.id)) {
              toast.error(`${u.displayName} is already in this group`);
              return;
            }
            setAddingMemberId(u.id);
            try {
              const res = await fetch(`/api/messages/${conversationId}/members`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: u.id }),
              });
              if (!res.ok) { toast.error("Failed to add member"); return; }
              queryClient.invalidateQueries({ queryKey: ["conversation", conversationId] });
              toast.success(`${u.displayName} added`);
              setShowAddMember(false);
            } finally {
              setAddingMemberId(null);
            }
          }}
        />
      )}
    </div>
  );
}
