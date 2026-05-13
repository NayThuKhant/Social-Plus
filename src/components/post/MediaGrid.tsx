"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { MediaType } from "@/lib/constants";

type MediaGridProps = {
  urls: string[];
  types: string[];
};

export function MediaGrid({ urls, types }: MediaGridProps) {
  const [lightbox, setLightbox] = useState<number | null>(null);

  useEffect(() => {
    if (lightbox === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightbox(null);
      if (e.key === "ArrowRight") setLightbox((i) => (i === null ? null : (i + 1) % urls.length));
      if (e.key === "ArrowLeft") setLightbox((i) => (i === null ? null : (i - 1 + urls.length) % urls.length));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, urls.length]);

  if (!urls.length) return null;

  const count = urls.length;

  const gridClass = cn(
    "grid gap-1 rounded-xl overflow-hidden mt-3",
    count === 1 && "grid-cols-1",
    count === 2 && "grid-cols-2",
    count === 3 && "grid-cols-2",
    count === 4 && "grid-cols-2"
  );

  return (
    <>
      <div className={gridClass}>
        {urls.map((url, i) => {
          const type = types[i] || MediaType.IMAGE;
          const isVideo = type === MediaType.VIDEO;
          const rowSpan = count === 3 && i === 0 ? "row-span-2" : "";

          return (
            <div
              key={i}
              className={cn("relative overflow-hidden cursor-pointer bg-[var(--border)]", rowSpan)}
              style={{ aspectRatio: count === 1 ? "16/9" : "1" }}
              onClick={() => !isVideo && setLightbox(i)}
            >
              {isVideo ? (
                <video
                  src={url}
                  controls
                  className="w-full h-full object-cover"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={url}
                  alt={`Media ${i + 1}`}
                  className="w-full h-full object-cover hover:opacity-90 transition-opacity"
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Lightbox */}
      {lightbox !== null && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center"
          onClick={() => setLightbox(null)}
        >
          <img
            src={urls[lightbox]}
            alt="Media"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            className="absolute top-4 right-4 text-white text-2xl font-bold"
            onClick={() => setLightbox(null)}
          >
            ✕
          </button>
          {urls.length > 1 && (
            <>
              <button
                className="absolute left-4 text-white text-3xl"
                onClick={(e) => { e.stopPropagation(); setLightbox((lightbox - 1 + urls.length) % urls.length); }}
              >
                ‹
              </button>
              <button
                className="absolute right-4 text-white text-3xl"
                onClick={(e) => { e.stopPropagation(); setLightbox((lightbox + 1) % urls.length); }}
              >
                ›
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}
