import { NextRequest, NextResponse } from "next/server";

function extractMeta(html: string, prop: string): string {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${prop}["']`, "i"),
    new RegExp(`<meta[^>]+name=["']${prop.replace("og:", "")}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${prop.replace("og:", "")}["']`, "i"),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return m[1].trim();
  }
  return "";
}

function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m?.[1]?.trim() ?? "";
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "No URL" }, { status: 400 });

  try {
    new URL(url); // validate URL
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Vibe/1.0; +LinkPreview)",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(5000),
      next: { revalidate: 3600 },
    });

    if (!res.ok) return NextResponse.json({ error: "Fetch failed" }, { status: 502 });

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      return NextResponse.json({ error: "Not HTML" }, { status: 415 });
    }

    const html = await res.text();
    const hostname = new URL(url).hostname.replace(/^www\./, "");

    return NextResponse.json({
      data: {
        title: extractMeta(html, "og:title") || extractTitle(html),
        description: extractMeta(html, "og:description") || extractMeta(html, "description"),
        image: extractMeta(html, "og:image"),
        siteName: extractMeta(html, "og:site_name") || hostname,
        url,
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
