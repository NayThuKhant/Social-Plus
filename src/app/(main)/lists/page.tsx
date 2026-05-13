"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, List } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { MobilePageHeader } from "@/components/layout/MobilePageHeader";

type ListItem = { id: string; name: string; description: string | null; isPrivate: boolean; _count: { members: number } };

export default function ListsPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", isPrivate: false });

  const { data, isLoading } = useQuery<{ data: ListItem[] }>({
    queryKey: ["lists"],
    queryFn: () => fetch("/api/lists").then((r) => r.json()),
  });

  const { mutate: createList, isPending } = useMutation({
    mutationFn: () =>
      fetch("/api/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      setShowCreate(false);
      setForm({ name: "", description: "", isPrivate: false });
      toast.success("List created!");
    },
  });

  const lists = data?.data || [];

  return (
    <div>
<MobilePageHeader className="bg-[var(--background)]/80 backdrop-blur-md border-b border-[var(--border)] px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-bold">Lists</h1>
        <button onClick={() => setShowCreate(true)} className="p-2 rounded-full hover:bg-[var(--hover)]">
          <Plus size={20} />
        </button>
      </MobilePageHeader>

      {/* Create list modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--background)] rounded-2xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-xl font-bold">Create a List</h2>
            <input
              type="text"
              placeholder="List name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              maxLength={25}
              className="w-full px-4 py-2 rounded-lg border border-[var(--border)] bg-transparent outline-none focus:border-[var(--accent)]"
            />
            <textarea
              placeholder="Description (optional)"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
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
                onClick={() => setForm({ ...form, isPrivate: !form.isPrivate })}
                className={`w-10 h-6 rounded-full transition-colors ${form.isPrivate ? "bg-[var(--accent)]" : "bg-[var(--border)]"}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white mx-auto transition-transform ${form.isPrivate ? "translate-x-2" : "-translate-x-2"}`} />
              </button>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-2 rounded-full border border-[var(--border)] font-medium text-sm">Cancel</button>
              <button onClick={() => createList()} disabled={!form.name || isPending} className="flex-1 py-2 rounded-full bg-[var(--foreground)] text-[var(--background)] font-bold text-sm disabled:opacity-50">
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading && <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" /></div>}

      {lists.map((list) => (
        <Link key={list.id} href={`/lists/${list.id}`} className="flex items-center gap-4 px-4 py-4 border-b border-[var(--border)] hover:bg-[var(--hover)] transition-colors">
          <div className="w-10 h-10 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center">
            <List size={20} className="text-[var(--accent)]" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="font-bold">{list.name}</p>
              {list.isPrivate && <span className="text-xs bg-[var(--border)] px-2 py-0.5 rounded-full">Private</span>}
            </div>
            {list.description && <p className="text-[var(--muted)] text-sm">{list.description}</p>}
            <p className="text-[var(--muted)] text-sm">{list._count.members} members</p>
          </div>
        </Link>
      ))}

      {!isLoading && lists.length === 0 && (
        <div className="text-center py-16">
          <h2 className="text-2xl font-bold mb-2">You haven&apos;t created any lists yet</h2>
          <p className="text-[var(--muted)] mb-6">Lists are a great way to organize accounts and topics.</p>
          <button onClick={() => setShowCreate(true)} className="px-6 py-3 rounded-full bg-[var(--accent)] text-white font-bold">
            Create a List
          </button>
        </div>
      )}
    </div>
  );
}
