import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatDistanceToNowStrict } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return formatDistanceToNowStrict(d, { addSuffix: true });
}

export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export function extractHashtags(text: string): string[] {
  const matches = text.match(/#[\w]+/g) || [];
  return [...new Set(matches.map((t) => t.slice(1).toLowerCase()))];
}

export function extractMentions(text: string): string[] {
  const matches = text.match(/@[\w]+/g) || [];
  return [...new Set(matches.map((t) => t.slice(1).toLowerCase()))];
}

export function slugifyUsername(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 20);
}

export function getMediaType(
  mimeType: string
): "image" | "video" | "gif" | null {
  if (mimeType === "image/gif") return "gif";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  return null;
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 3) + "...";
}

export const MAX_POST_LENGTH = 280;
export const MAX_MEDIA_FILES = 4;
export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
