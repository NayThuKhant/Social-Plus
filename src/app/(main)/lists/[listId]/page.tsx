"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Lock, MoreHorizontal, UserPlus, Trash2, UserMinus } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/shared/Avatar";
import { useAuthStore } from "@/store/authStore";
import { toast } from "sonner";

type Member = {
  addedAt: string;
  user: { id: string; username: string; displayName: string; avatarUrl: string | null; bio: string | null };
};

type ListDetail = {
  id: string;
  name: string;
  description: string | null;
  isPrivate: boolean;
  ownerId: string;
  owner: { id: string; username: string; displayName: string; avatarUrl: string | null };
  members: Member[];
  _count: { members: number };
};

export default function ListDetailPage() {
  const { listId } = useParams<{ listId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const [addUsername, setAddUsername] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", description: "", isPrivate: false });

  const { data, isLoading, isError } = useQuery<{ data: ListDetail }>({
    queryKey: ["list", listId],
    queryFn: () => fetch(`/api/lists/${listId}`).then((r) => r.json()),
    enabled: !!listId,
  });

  const list = data?.data;
  const isOwner = user?.id === list?.ownerId;

  const { mutate: addMember, isPending: addPending } = useMutation({
    mutationFn: () =>
      fetch(`/api/lists/${listId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: addUsername }),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Failed");
        return d;
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["list", listId] });
      setAddUsername("");
      setShowAddForm(false);
      toast.success("Member added");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const { mutate: removeMember } = useMutation({
    mutationFn: (userId: string) =>
      fetch(`/api/lists/${listId}/members?userId=${userId}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["list", listId] });
      toast.success("Member removed");
    },
  });

  const { mutate: deleteList, isPending: deletePending } = useMutation({
    mutationFn: () => fetch(`/api/lists/${listId}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      router.push("/lists");
      toast.success("List deleted");
    },
  });

  const { mutate: saveEdit, isPending: savePending } = useMutation({
    mutationFn: () =>
      fetch(`/api/lists/${listId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Failed");
        return d;
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["list", listId] });
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      setEditMode(false);
      toast.success("List updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function openEdit() {
    if (!list) return;
    setEditForm({ name: list.name, description: list.description ?? "", isPrivate: list.isPrivate });
    setEditMode(true);
    setShowMenu(false);
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isError || !list) {
    return (
      <div className="text-center py-16">
        <p className="text-xl font-bold">List not found</p>
        <Link href="/lists" className="text-[var(--accent)] mt-2 inline-block">Back to Lists</Link>
      </div>
    );
  }

  return (
    <div>
{/* Header */}
      <div className="sticky top-0 bg-[var(--background)]/80 backdrop-blur-md border-b border-[var(--border)] px-4 py-3 z-10 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 rounded-full hover:bg-[var(--hover)]">
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-xl font-bold leading-tight">{list.name}</h1>
              {list.isPrivate && <Lock size={14} className="text-[var(--muted)]" />}
            </div>
            <p className="text-[var(--muted)] text-sm">{list._count.members} members</p>
          </div>
        </div>

        {isOwner && (
          <div className="relative">
            <button
              onClick={() => setShowMenu((v) => !v)}
              className="p-2 rounded-full hover:bg-[var(--hover)]"
            >
              <MoreHorizontal size={20} />
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-full mt-1 w-44 bg-[var(--background)] border border-[var(--border)] rounded-2xl shadow-lg z-50 overflow-hidden">
                  <button
                    onClick={openEdit}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--hover)] w-full text-left text-sm"
                  >
                    Edit list
                  </button>
                  <button
                    onClick={() => { setShowMenu(false); setShowAddForm(true); }}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--hover)] w-full text-left text-sm"
                  >
                    <UserPlus size={16} />
                    Add member
                  </button>
                  <button
                    onClick={() => { setShowMenu(false); deleteList(); }}
                    disabled={deletePending}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--hover)] w-full text-left text-sm text-red-500"
                  >
                    <Trash2 size={16} />
                    Delete list
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Description */}
      {list.description && (
        <div className="px-4 py-3 border-b border-[var(--border)]">
          <p className="text-[var(--muted)] text-sm">{list.description}</p>
          <p className="text-[var(--muted)] text-xs mt-1">
            By{" "}
            <Link href={`/${list.owner.username}`} className="text-[var(--accent)] hover:underline">
              @{list.owner.username}
            </Link>
          </p>
        </div>
      )}

      {/* Members */}
      <div>
        {list.members.length === 0 && (
          <div className="text-center py-12">
            <p className="text-[var(--muted)]">No members yet.</p>
            {isOwner && (
              <button
                onClick={() => setShowAddForm(true)}
                className="mt-4 px-5 py-2 rounded-full bg-[var(--accent)] text-white font-bold text-sm"
              >
                Add members
              </button>
            )}
          </div>
        )}

        {list.members.map(({ user: member }) => (
          <div
            key={member.id}
            className="flex items-start gap-3 px-4 py-4 border-b border-[var(--border)] hover:bg-[var(--hover)] transition-colors"
          >
            <Link href={`/${member.username}`}>
              <Avatar src={member.avatarUrl} alt={member.displayName} size="md" />
            </Link>
            <div className="flex-1 min-w-0">
              <Link href={`/${member.username}`} className="hover:underline">
                <p className="font-bold truncate">{member.displayName}</p>
                <p className="text-[var(--muted)] text-sm">@{member.username}</p>
              </Link>
              {member.bio && <p className="text-sm mt-0.5 line-clamp-2">{member.bio}</p>}
            </div>
            {isOwner && (
              <button
                onClick={() => removeMember(member.id)}
                className="p-2 rounded-full hover:bg-rose-500/10 text-[var(--muted)] hover:text-rose-500 transition-colors flex-shrink-0"
                title="Remove from list"
              >
                <UserMinus size={18} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Add member modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--background)] rounded-2xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-xl font-bold">Add a member</h2>
            <input
              type="text"
              placeholder="Username (without @)"
              value={addUsername}
              onChange={(e) => setAddUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addUsername && addMember()}
              className="w-full px-4 py-2 rounded-lg border border-[var(--border)] bg-transparent outline-none focus:border-[var(--accent)]"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setShowAddForm(false); setAddUsername(""); }}
                className="flex-1 py-2 rounded-full border border-[var(--border)] font-medium text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => addMember()}
                disabled={!addUsername || addPending}
                className="flex-1 py-2 rounded-full bg-[var(--foreground)] text-[var(--background)] font-bold text-sm disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit list modal */}
      {editMode && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--background)] rounded-2xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-xl font-bold">Edit list</h2>
            <input
              type="text"
              placeholder="List name"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              maxLength={25}
              className="w-full px-4 py-2 rounded-lg border border-[var(--border)] bg-transparent outline-none focus:border-[var(--accent)]"
            />
            <textarea
              placeholder="Description (optional)"
              value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              maxLength={100}
              rows={2}
              className="w-full px-4 py-2 rounded-lg border border-[var(--border)] bg-transparent outline-none focus:border-[var(--accent)] resize-none"
            />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Private list</p>
                <p className="text-[var(--muted)] text-xs">Only you can see this list</p>
              </div>
              <button
                onClick={() => setEditForm({ ...editForm, isPrivate: !editForm.isPrivate })}
                className={`w-10 h-6 rounded-full transition-colors ${editForm.isPrivate ? "bg-[var(--accent)]" : "bg-[var(--border)]"}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white mx-auto transition-transform ${editForm.isPrivate ? "translate-x-2" : "-translate-x-2"}`} />
              </button>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setEditMode(false)} className="flex-1 py-2 rounded-full border border-[var(--border)] font-medium text-sm">
                Cancel
              </button>
              <button
                onClick={() => saveEdit()}
                disabled={!editForm.name || savePending}
                className="flex-1 py-2 rounded-full bg-[var(--foreground)] text-[var(--background)] font-bold text-sm disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
