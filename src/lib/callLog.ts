function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export async function logCall(
  conversationId: string,
  type: "missed" | "ended",
  options?: { isVideo?: boolean; durationSeconds?: number }
) {
  try {
    await fetch(`/api/messages/${conversationId}/call-log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        isVideo: options?.isVideo ?? false,
        duration: options?.durationSeconds,
      }),
    });
  } catch {
    // Best-effort — never throw
  }
}

export function callMessageContent(type: "missed" | "ended", isVideo: boolean, duration?: number): string {
  const icon = isVideo ? "📹" : "📞";
  if (type === "missed") return `${icon} Missed ${isVideo ? "video" : "voice"} call`;
  const kind = isVideo ? "Video call" : "Voice call";
  return duration ? `${icon} ${kind} · ${formatDuration(duration)}` : `${icon} ${kind}`;
}
