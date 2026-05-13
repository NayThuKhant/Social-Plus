export function requestNotificationPermission() {
  if (typeof window === "undefined") return;
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    Notification.requestPermission();
  }
}

// Register the service worker so we can use showNotification(),
// which is more reliable than new Notification() in modern Chrome.
export function registerServiceWorker() {
  if (typeof navigator === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}

type BrowserNotifyOptions = {
  body?: string;
  tag?: string;
  url?: string;
};

export async function browserNotify(title: string, options: BrowserNotifyOptions = {}) {
  if (typeof window === "undefined") return;
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  const payload: NotificationOptions = {
    body: options.body,
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    tag: options.tag,
    data: { url: options.url },
  };

  try {
    if ("serviceWorker" in navigator) {
      // Preferred: service worker notifications persist and work even when the
      // tab is hidden. navigator.serviceWorker.ready resolves once sw.js is active.
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, payload);
    } else {
      // Fallback for browsers without service worker support
      const n = new Notification(title, payload);
      n.onclick = () => {
        n.close();
        if (options.url) window.open(options.url, "_blank");
        else window.focus();
      };
    }
  } catch (err) {
    console.error("[browserNotify]", err);
  }
}
