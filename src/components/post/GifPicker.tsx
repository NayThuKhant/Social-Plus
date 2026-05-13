"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Gif = { id: string; preview: string; original: string };

type GifsResponse = { data: Gif[]; enabled?: boolean };

type Props = {
  onSelect: (original: string, preview: string) => void;
  onClose: () => void;
  openUp?: boolean;
};

export function GifPicker({ onSelect, onClose, openUp = false }: Props) {
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState<Gif[]>([]);
  const [loading, setLoading] = useState(false);
  const [configured, setConfigured] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchGifs = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const url = q.trim() ? `/api/gifs?q=${encodeURIComponent(q)}` : "/api/gifs";
      const res = await fetch(url);
      const data: GifsResponse = await res.json();
      if (data.data.length === 0 && !q.trim()) setConfigured(false);
      setGifs(data.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load trending on mount
  useEffect(() => { fetchGifs(""); }, [fetchGifs]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchGifs(query), 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, fetchGifs]);

  // Close on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onClose]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "bg-[var(--background)] border border-[var(--border)] shadow-2xl overflow-hidden z-50",
        // Mobile: full-width bottom sheet
        "fixed inset-x-0 bottom-0 rounded-t-2xl",
        // Desktop: absolute dropdown
        "md:absolute md:inset-x-auto md:w-80 md:rounded-2xl md:left-0 md:bottom-auto",
        openUp ? "md:bottom-full md:top-auto md:mb-2" : "md:top-full md:bottom-auto md:mt-2"
      )}
    >
      {/* Drag handle — mobile only */}
      <div className="flex justify-center pt-2.5 pb-0.5 md:hidden">
        <div className="w-10 h-1 rounded-full bg-[var(--muted)]/30" />
      </div>
      {/* Search bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)]">
        <Search size={14} className="text-[var(--muted)] flex-shrink-0" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search GIFs…"
          className="flex-1 bg-transparent text-sm outline-none"
        />
        {query && (
          <button type="button" onClick={() => setQuery("")} className="text-[var(--muted)] hover:text-[var(--foreground)]">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Grid */}
      <div className="h-[50vh] md:h-64 overflow-y-auto p-1.5">
        {loading && (
          <div className="flex items-center justify-center h-full">
            <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {!loading && !configured && (
          <div className="flex flex-col items-center justify-center h-full gap-2 px-4 text-center">
            <p className="font-semibold text-sm">GIF search not configured</p>
            <p className="text-[var(--muted)] text-xs">Add <code className="bg-[var(--hover)] px-1 rounded">GIPHY_API_KEY</code> to your <code className="bg-[var(--hover)] px-1 rounded">.env</code> to enable this feature.</p>
          </div>
        )}
        {!loading && configured && gifs.length === 0 && (
          <p className="text-center text-[var(--muted)] text-sm py-10">No GIFs found</p>
        )}
        {!loading && configured && gifs.length > 0 && (
          <div className="columns-2 gap-1.5 space-y-1.5">
            {gifs.map((gif) => (
              <button
                key={gif.id}
                type="button"
                onClick={() => { onSelect(gif.original, gif.preview); onClose(); }}
                className="block w-full rounded-lg overflow-hidden hover:opacity-80 transition-opacity"
              >
                <img src={gif.preview} alt="" className="w-full h-auto" loading="lazy" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Attribution — required by Giphy TOS */}
      <div className="flex items-center justify-end px-3 py-1.5 border-t border-[var(--border)]">
        <span className="text-[var(--muted)] text-xs font-medium">Powered by GIPHY</span>
      </div>
    </div>
  );
}
