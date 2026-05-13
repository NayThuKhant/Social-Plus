"use client";

import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";

type Meta = {
  title: string;
  description: string;
  image: string;
  siteName: string;
  url: string;
};

export function LinkPreview({ url, compact = false }: { url: string; compact?: boolean }) {
  const { data, isLoading } = useQuery<{ data: Meta }>({
    queryKey: ["link-preview", url],
    queryFn: () =>
      fetch(`/api/link-preview?url=${encodeURIComponent(url)}`).then((r) => r.json()),
    staleTime: 60 * 60 * 1000,
    retry: false,
  });

  const meta = data?.data;

  if (isLoading) {
    return (
      <div className="mt-2 rounded-xl border border-[var(--border)] overflow-hidden animate-pulse">
        <div className="h-3 bg-[var(--border)] rounded m-3 w-2/3" />
        <div className="h-2 bg-[var(--border)] rounded mx-3 mb-3 w-1/2" />
      </div>
    );
  }

  if (!meta?.title) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`mt-2 flex rounded-xl border border-[var(--border)] overflow-hidden hover:bg-[var(--hover)] transition-colors ${compact ? "max-w-[280px]" : "max-w-lg"}`}
    >
      {meta.image && !compact && (
        <img
          src={meta.image}
          alt=""
          className="w-24 h-24 object-cover flex-shrink-0"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      )}
      <div className="flex flex-col justify-center px-3 py-2.5 min-w-0 flex-1">
        <div className="flex items-center gap-1 text-[10px] text-[var(--muted)] mb-0.5 uppercase tracking-wide">
          <ExternalLink size={9} />
          <span className="truncate">{meta.siteName}</span>
        </div>
        {meta.title && (
          <p className="text-sm font-semibold leading-snug line-clamp-2">{meta.title}</p>
        )}
        {meta.description && !compact && (
          <p className="text-xs text-[var(--muted)] mt-0.5 line-clamp-2 leading-snug">{meta.description}</p>
        )}
      </div>
    </a>
  );
}

const URL_RE = /https?:\/\/[^\s<>"]+/gi;

export function extractUrls(text: string): string[] {
  return Array.from(new Set(text.match(URL_RE) ?? []));
}
