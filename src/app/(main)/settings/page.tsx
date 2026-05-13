"use client";

import { useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { Avatar } from "@/components/shared/Avatar";
import { MobilePageHeader } from "@/components/layout/MobilePageHeader";
import Link from "next/link";

export default function SettingsPage() {
  const { user, setUser } = useAuthStore();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    displayName: user?.displayName || "",
    bio: user?.bio || "",
    location: user?.location || "",
    website: user?.website || "",
    isPrivate: user?.isPrivate || false,
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);

  if (!user) return null;

  async function uploadMedia(file: File, context: string): Promise<string | null> {
    const form = new FormData();
    form.append("file", file);
    form.append("context", context);
    const res = await fetch("/api/upload", { method: "POST", body: form });
    const data = await res.json();
    return res.ok ? data.data.url : null;
  }

  async function handleSave() {
    setSaving(true);
    try {
      let avatarUrl = user!.avatarUrl;
      let bannerUrl = user!.bannerUrl;

      if (avatarFile) avatarUrl = await uploadMedia(avatarFile, "avatar");
      if (bannerFile) bannerUrl = await uploadMedia(bannerFile, "banner");

      const res = await fetch(`/api/users/${user!.username}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, avatarUrl, bannerUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUser(data.data);
      queryClient.invalidateQueries({ queryKey: ["profile", user!.username] });
      toast.success("Profile updated!");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  }

  function handleBannerChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setBannerFile(file);
      setBannerPreview(URL.createObjectURL(file));
    }
  }

  const inputClass = "w-full px-4 py-3 rounded-lg border border-[var(--border)] bg-transparent focus:outline-none focus:border-[var(--accent)] transition-colors text-sm";

  return (
    <div>
<MobilePageHeader className="bg-[var(--background)]/80 backdrop-blur-md border-b border-[var(--border)] px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-bold">Settings</h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-1.5 rounded-full bg-[var(--foreground)] text-[var(--background)] font-bold text-sm disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </MobilePageHeader>

      <div className="max-w-xl mx-auto px-4 py-6 space-y-8">
        {/* Appearance */}
        <section>
          <h2 className="text-lg font-bold mb-4">Appearance</h2>
          <div className="flex items-center justify-between p-4 border border-[var(--border)] rounded-xl">
            <div>
              <p className="font-medium">Dark mode</p>
              <p className="text-[var(--muted)] text-sm">Switch between light and dark</p>
            </div>
            <ThemeToggle />
          </div>
        </section>

        {/* Profile */}
        <section>
          <h2 className="text-lg font-bold mb-4">Profile</h2>

          {/* Banner + Avatar — avatar must live OUTSIDE overflow-hidden */}
          <div className="relative mb-16">
            <label className="block relative h-32 bg-[var(--border)] rounded-xl cursor-pointer overflow-hidden">
              {(bannerPreview || user.bannerUrl) && (
                <img src={bannerPreview || user.bannerUrl || ""} alt="Banner" className="w-full h-full object-cover" />
              )}
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                <span className="text-white text-sm font-medium">Change banner</span>
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={handleBannerChange} />
            </label>

            {/* Avatar sits on the bottom edge of the banner, outside overflow-hidden */}
            <label className="absolute -bottom-10 left-4 cursor-pointer z-10 ring-4 ring-[var(--background)] rounded-full block">
              <Avatar src={avatarPreview || user.avatarUrl} alt={user.displayName} size="xl" />
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </label>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Display name</label>
              <input type="text" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} maxLength={50} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Bio</label>
              <textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} maxLength={160} rows={3} className={`${inputClass} resize-none`} placeholder="Tell the world about yourself" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Location</label>
              <input type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} maxLength={30} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Website</label>
              <input type="url" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} className={inputClass} placeholder="https://yourwebsite.com" />
            </div>
          </div>
        </section>

        {/* Privacy */}
        <section>
          <h2 className="text-lg font-bold mb-4">Privacy</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 border border-[var(--border)] rounded-xl">
              <div>
                <p className="font-medium">Private account</p>
                <p className="text-[var(--muted)] text-sm">Only approved followers can see your posts</p>
              </div>
              <button
                onClick={() => setForm({ ...form, isPrivate: !form.isPrivate })}
                className={`relative w-12 h-6 rounded-full transition-colors ${form.isPrivate ? "bg-[var(--accent)]" : "bg-[var(--border)]"}`}
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${form.isPrivate ? "translate-x-7" : "translate-x-1"}`} />
              </button>
            </div>
            <Link
              href="/settings/blocked"
              className="flex items-center justify-between p-4 border border-[var(--border)] rounded-xl hover:bg-[var(--hover)] transition-colors"
            >
              <div>
                <p className="font-medium">Blocked accounts</p>
                <p className="text-[var(--muted)] text-sm">Manage accounts you&apos;ve blocked</p>
              </div>
              <span className="text-[var(--muted)] text-sm">›</span>
            </Link>
          </div>
        </section>

        {/* Account info */}
        <section>
          <h2 className="text-lg font-bold mb-4">Account</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-2 border-b border-[var(--border)]">
              <span className="text-[var(--muted)]">Username</span>
              <span className="font-medium">@{user.username}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-[var(--border)]">
              <span className="text-[var(--muted)]">Email</span>
              <span className="font-medium">{user.email}</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
