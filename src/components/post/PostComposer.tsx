"use client";

import { useState, useRef, useEffect } from "react";
import { Image as ImageIcon, BarChart2, X, CalendarDays, Smile } from "lucide-react";
import { DateTimePicker } from "@/components/post/DateTimePicker";
import { useAuthStore } from "@/store/authStore";
import { Avatar } from "@/components/shared/Avatar";
import { VerifiedBadge } from "@/components/shared/VerifiedBadge";
import { GifPicker } from "@/components/post/GifPicker";
import { toast } from "sonner";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { MAX_POST_LENGTH } from "@/lib/utils";
import { MediaType } from "@/lib/constants";
import { useTheme } from "@/lib/theme";
import type { PostWithUser, SafeUser } from "@/types";
import dynamic from "next/dynamic";

const EmojiPicker = dynamic(() => import("emoji-picker-react"), { ssr: false });
import { Theme as EmojiTheme } from "emoji-picker-react";

type PostComposerProps = {
  placeholder?: string;
  replyToId?: string;
  quoteOfId?: string;
  onSuccess?: (post: PostWithUser) => void;
  autoFocus?: boolean;
};

type MediaFile = { url: string; type: string; file: File };

export function PostComposer({
  placeholder = "What's happening?!",
  replyToId,
  quoteOfId,
  onSuccess,
  autoFocus,
}: PostComposerProps) {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const { theme } = useTheme();
  const [content, setContent] = useState("");
  const [media, setMedia] = useState<MediaFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [showPoll, setShowPoll] = useState(false);
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [pollDuration, setPollDuration] = useState(24);
  const [scheduledAt, setScheduledAt] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerOpenUp, setDatePickerOpenUp] = useState(false);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);
  const [showGif, setShowGif] = useState(false);
  const gifRef = useRef<HTMLDivElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const [gif, setGif] = useState<{ original: string; preview: string } | null>(null);
  const [emojiOpenUp, setEmojiOpenUp] = useState(false);
  const [gifOpenUp, setGifOpenUp] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState(-1);
  const [mentionIndex, setMentionIndex] = useState(0);
  const mentionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
        setShowEmoji(false);
      }
    }
    if (showEmoji) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showEmoji]);

  const { data: mentionResults } = useQuery<{ data: { users: SafeUser[] } }>({
    queryKey: ["mention-search", mentionQuery],
    queryFn: () => fetch(`/api/search?type=users&q=${encodeURIComponent(mentionQuery!)}`).then((r) => r.json()),
    enabled: mentionQuery !== null && mentionQuery.length > 0,
    staleTime: 10000,
  });
  const mentionUsers = mentionResults?.data?.users?.slice(0, 5) || [];

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (mentionRef.current && !mentionRef.current.contains(e.target as Node)) {
        setMentionQuery(null);
      }
    }
    if (mentionQuery !== null) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [mentionQuery]);

  function handleContentChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setContent(val);
    const cursor = e.target.selectionStart ?? val.length;
    const textBefore = val.slice(0, cursor);
    const match = textBefore.match(/@(\w*)$/);
    if (match) {
      setMentionQuery(match[1]);
      setMentionStart(cursor - match[0].length);
      setMentionIndex(0);
    } else {
      setMentionQuery(null);
      setMentionStart(-1);
    }
  }

  function insertMention(username: string) {
    const before = content.slice(0, mentionStart);
    const after = content.slice(mentionStart + 1 + (mentionQuery?.length ?? 0));
    const next = `${before}@${username} ${after}`;
    setContent(next);
    setMentionQuery(null);
    setMentionStart(-1);
    setTimeout(() => {
      const pos = mentionStart + username.length + 2;
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(pos, pos);
    }, 0);
  }

  function highlightContent(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/([@#]\w+)/g, '<span style="color:var(--accent)">$1</span>');
  }

  const remaining = MAX_POST_LENGTH - content.length;
  const canSubmit = (content.trim() || media.length > 0 || showPoll || gif) && remaining >= 0 && !submitting;

  async function uploadFile(file: File): Promise<{ url: string; mediaType: string } | null> {
    const form = new FormData();
    form.append("file", file);
    form.append("context", "media");
    const res = await fetch("/api/upload", { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data.data;
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []).slice(0, 4 - media.length);
    for (const file of files) {
      const preview = URL.createObjectURL(file);
      setMedia((m) => [...m, { url: preview, type: file.type.startsWith("video") ? MediaType.VIDEO : MediaType.IMAGE, file }]);
    }
    e.target.value = "";
  }

  async function handleSubmit() {
    if (!canSubmit || !user) return;
    setSubmitting(true);

    try {
      // Upload media
      const uploaded: { url: string; type: string }[] = [];
      for (const m of media) {
        const result = await uploadFile(m.file);
        if (result) uploaded.push({ url: result.url, type: result.mediaType });
      }

      const poll = showPoll
        ? {
            options: pollOptions.filter((o) => o.trim()),
            expiresAt: new Date(Date.now() + pollDuration * 60 * 60 * 1000).toISOString(),
          }
        : undefined;

      const mediaUrls = [...uploaded.map((u) => u.url), ...(gif ? [gif.original] : [])];
      const mediaTypes = [...uploaded.map((u) => u.type), ...(gif ? [MediaType.GIF] : [])];

      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim() || undefined,
          mediaUrls,
          mediaTypes,
          replyToId,
          quoteOfId,
          scheduledAt: scheduledAt || undefined,
          poll,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setContent("");
      setMedia([]);
      setGif(null);
      setShowPoll(false);
      setPollOptions(["", ""]);
      setScheduledAt("");
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      if (replyToId) {
        // Optimistically increment parent's reply count so the number updates immediately
        queryClient.setQueryData(
          ["post", replyToId],
          (old: { data: { repliesCount: number } } | undefined) => {
            if (!old?.data) return old;
            return { ...old, data: { ...old.data, repliesCount: old.data.repliesCount + 1 } };
          }
        );
        queryClient.invalidateQueries({ queryKey: ["replies", replyToId] });
        queryClient.invalidateQueries({ queryKey: ["post", replyToId] });
      }
      onSuccess?.(data.data);
      toast.success(scheduledAt ? "Post scheduled!" : "Posted!");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to post");
    } finally {
      setSubmitting(false);
    }
  }

  if (!user) return null;

  return (
    <div className="flex gap-3 p-4">
      <Avatar src={user.avatarUrl} alt={user.displayName} size="md" />
      <div className="flex-1 min-w-0">
        <div className="relative">
          {/* Mirror div for @mention and #hashtag color highlighting */}
          <div
            aria-hidden
            ref={mirrorRef}
            className="absolute inset-0 pointer-events-none overflow-hidden text-lg leading-relaxed whitespace-pre-wrap break-words"
            style={{ padding: 0 }}
            dangerouslySetInnerHTML={{ __html: highlightContent(content) }}
          />
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleContentChange}
            placeholder={placeholder}
            autoFocus={autoFocus}
            rows={3}
            className="w-full bg-transparent resize-none outline-none text-lg placeholder:text-[var(--muted)] leading-relaxed relative"
            style={{ color: 'transparent', caretColor: 'var(--foreground)', padding: 0 }}
            onScroll={() => {
              if (mirrorRef.current && textareaRef.current) {
                mirrorRef.current.scrollTop = textareaRef.current.scrollTop;
              }
            }}
            onKeyDown={(e) => {
              if (mentionQuery !== null && mentionUsers.length > 0) {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setMentionIndex((i) => (i + 1) % mentionUsers.length);
                  return;
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setMentionIndex((i) => (i - 1 + mentionUsers.length) % mentionUsers.length);
                  return;
                }
                if (e.key === "Enter" || e.key === "Tab") {
                  e.preventDefault();
                  insertMention(mentionUsers[mentionIndex].username);
                  return;
                }
              }
              if (e.key === "Escape") { setMentionQuery(null); return; }
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit();
            }}
          />
          {/* Mention autocomplete dropdown */}
          {mentionQuery !== null && mentionUsers.length > 0 && (
            <div ref={mentionRef} className="absolute top-full left-0 z-50 w-72 bg-[var(--background)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden">
              {mentionUsers.map((u, i) => (
                <button
                  key={u.id}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); insertMention(u.username); }}
                  onMouseEnter={() => setMentionIndex(i)}
                  className={`flex items-center gap-3 w-full px-4 py-3 transition-colors text-left ${i === mentionIndex ? "bg-[var(--hover)]" : "hover:bg-[var(--hover)]"}`}
                >
                  <Avatar src={u.avatarUrl} alt={u.displayName} size="sm" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-sm truncate">{u.displayName}</span>
                      {u.verified && <VerifiedBadge size={13} />}
                    </div>
                    <p className="text-[var(--muted)] text-xs">@{u.username}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Media previews */}
        {media.length > 0 && (
          <div className={`grid gap-1 rounded-xl overflow-hidden mt-2 ${media.length > 1 ? "grid-cols-2" : ""}`}>
            {media.map((m, i) => (
              <div key={i} className="relative aspect-video bg-[var(--border)] rounded-lg overflow-hidden">
                {m.type === "video" ? (
                  <video src={m.url} className="w-full h-full object-cover" />
                ) : (
                  <img src={m.url} alt="" className="w-full h-full object-cover" />
                )}
                <button
                  onClick={() => setMedia((prev) => prev.filter((_, j) => j !== i))}
                  className="absolute top-1 right-1 bg-black/70 rounded-full p-1 text-white"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* GIF preview */}
        {gif && (
          <div className="relative inline-block mt-2 rounded-xl overflow-hidden">
            <img src={gif.preview} alt="GIF" className="max-h-48 rounded-xl" />
            <button
              onClick={() => setGif(null)}
              className="absolute top-1 right-1 bg-black/70 rounded-full p-1 text-white"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Poll */}
        {showPoll && (
          <div className="mt-3 border border-[var(--border)] rounded-xl p-4 space-y-2">
            {pollOptions.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={opt}
                  onChange={(e) => {
                    const next = [...pollOptions];
                    next[i] = e.target.value;
                    setPollOptions(next);
                  }}
                  placeholder={`Choice ${i + 1}`}
                  maxLength={25}
                  className="flex-1 px-3 py-2 rounded-full border border-[var(--border)] bg-transparent outline-none focus:border-[var(--accent)] text-sm"
                />
                {pollOptions.length > 2 && (
                  <button onClick={() => setPollOptions((p) => p.filter((_, j) => j !== i))}>
                    <X size={16} className="text-[var(--muted)]" />
                  </button>
                )}
              </div>
            ))}
            {pollOptions.length < 4 && (
              <button
                onClick={() => setPollOptions((p) => [...p, ""])}
                className="text-[var(--accent)] text-sm font-medium"
              >
                + Add choice
              </button>
            )}
            <select
              value={pollDuration}
              onChange={(e) => setPollDuration(Number(e.target.value))}
              className="w-full mt-2 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm"
            >
              <option value={1}>1 hour</option>
              <option value={24}>1 day</option>
              <option value={72}>3 days</option>
              <option value={168}>7 days</option>
            </select>
          </div>
        )}

        {/* Schedule */}
        {scheduledAt && (
          <div className="mt-2 inline-flex items-center gap-1.5 bg-[var(--accent)]/10 text-[var(--accent)] text-xs font-medium px-3 py-1.5 rounded-full">
            <CalendarDays size={12} />
            <span>{new Date(scheduledAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</span>
            <button onClick={() => setScheduledAt("")} className="ml-0.5 hover:opacity-70 transition-opacity">
              <X size={12} />
            </button>
          </div>
        )}

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--border)]">
          <div className="flex items-center gap-1 text-[var(--accent)]">
            <input ref={fileRef} type="file" multiple accept="image/*,video/*" onChange={handleFileChange} className="hidden" />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={media.length >= 4 || !!gif}
              className="p-2 rounded-full hover:bg-blue-500/10 transition-colors disabled:opacity-40"
            >
              <ImageIcon size={20} />
            </button>
            <button
              onClick={() => { setShowPoll(!showPoll); setMedia([]); }}
              disabled={media.length > 0}
              className="p-2 rounded-full hover:bg-blue-500/10 transition-colors disabled:opacity-40"
            >
              <BarChart2 size={20} />
            </button>
            <div className="relative" ref={emojiRef}>
              <button
                type="button"
                onClick={() => {
                  const rect = emojiRef.current?.getBoundingClientRect();
                  setEmojiOpenUp(rect ? rect.top > 420 : false);
                  setShowEmoji((v) => !v);
                }}
                className="p-2 rounded-full hover:bg-blue-500/10 transition-colors"
              >
                <Smile size={20} />
              </button>
              {showEmoji && (
                <>
                  {/* Mobile backdrop */}
                  <div
                    className="fixed inset-0 z-40 bg-black/50 md:hidden"
                    onMouseDown={() => setShowEmoji(false)}
                  />
                  {/* Bottom sheet on mobile, dropdown on desktop */}
                  <div className={[
                    "fixed inset-x-0 bottom-0 z-50 rounded-t-2xl overflow-hidden",
                    "md:absolute md:inset-x-auto md:rounded-2xl md:overflow-visible md:bottom-auto",
                    emojiOpenUp ? "md:bottom-full md:mb-2 md:top-auto" : "md:top-full md:mt-2",
                    "md:left-0",
                  ].join(" ")}>
                    <div className="flex justify-center pt-2.5 pb-0.5 bg-[var(--background)] md:hidden">
                      <div className="w-10 h-1 rounded-full bg-[var(--muted)]/30" />
                    </div>
                    <EmojiPicker
                      theme={theme === "dark" ? EmojiTheme.DARK : EmojiTheme.LIGHT}
                      onEmojiClick={(emojiData: { emoji: string }) => {
                        setContent((c) => c + emojiData.emoji);
                      }}
                      width="100%"
                    />
                  </div>
                </>
              )}
            </div>
            <div className="relative" ref={gifRef}>
              <button
                type="button"
                onClick={() => {
                  const rect = gifRef.current?.getBoundingClientRect();
                  setGifOpenUp(rect ? rect.top > 420 : false);
                  setShowGif((v) => !v);
                  setShowEmoji(false);
                }}
                disabled={media.length > 0}
                className="px-1.5 py-1 rounded-md hover:bg-blue-500/10 transition-colors disabled:opacity-40 text-xs font-extrabold tracking-wider"
              >
                GIF
              </button>
              {showGif && (
                <>
                  {/* Mobile backdrop */}
                  <div
                    className="fixed inset-0 z-40 bg-black/50 md:hidden"
                    onMouseDown={() => setShowGif(false)}
                  />
                  <GifPicker
                    openUp={gifOpenUp}
                    onSelect={(original, preview) => { setGif({ original, preview }); setMedia([]); }}
                    onClose={() => setShowGif(false)}
                  />
                </>
              )}
            </div>
            <div className="relative" ref={datePickerRef}>
              <button
                type="button"
                onClick={() => {
                  const rect = datePickerRef.current?.getBoundingClientRect();
                  setDatePickerOpenUp(rect ? rect.top > 420 : false);
                  setShowDatePicker((v) => !v);
                  setShowEmoji(false);
                  setShowGif(false);
                }}
                className={`p-2 rounded-full hover:bg-blue-500/10 transition-colors ${scheduledAt ? "text-[var(--accent)]" : ""}`}
              >
                <CalendarDays size={20} />
              </button>
              {showDatePicker && (
                <>
                  <div
                    className="fixed inset-0 z-40 bg-black/50 md:hidden"
                    onMouseDown={() => setShowDatePicker(false)}
                  />
                  <DateTimePicker
                    value={scheduledAt}
                    onChange={setScheduledAt}
                    onClose={() => setShowDatePicker(false)}
                    openUp={datePickerOpenUp}
                  />
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {content.length > 0 && (
              <div className="relative w-8 h-8">
                <svg className="w-8 h-8 -rotate-90" viewBox="0 0 32 32">
                  <circle cx="16" cy="16" r="12" fill="none" stroke="var(--border)" strokeWidth="3" />
                  <circle
                    cx="16" cy="16" r="12" fill="none"
                    stroke={remaining < 0 ? "var(--danger)" : remaining < 20 ? "#ffd400" : "var(--accent)"}
                    strokeWidth="3"
                    strokeDasharray={`${Math.max(0, (1 - Math.abs(remaining) / MAX_POST_LENGTH) * 75.4)} 75.4`}
                  />
                </svg>
                {remaining < 20 && (
                  <span className={`absolute inset-0 flex items-center justify-center text-xs font-bold ${remaining < 0 ? "text-[var(--danger)]" : ""}`}>
                    {remaining}
                  </span>
                )}
              </div>
            )}
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="px-4 py-1.5 rounded-full bg-[var(--accent)] text-white font-bold text-sm hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors"
            >
              {submitting ? "Posting..." : scheduledAt ? "Schedule" : "Post"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
