import { NextRequest, NextResponse } from "next/server";

type GiphyGif = {
  id: string;
  images: {
    fixed_height: { url: string; width: string; height: string };
    original: { url: string };
  };
};

export async function GET(req: NextRequest) {
  const apiKey = process.env.GIPHY_API_KEY;
  if (!apiKey) return NextResponse.json({ data: [] });

  const q = new URL(req.url).searchParams.get("q") ?? "";
  const endpoint = q.trim()
    ? `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(q)}&limit=30&rating=g`
    : `https://api.giphy.com/v1/gifs/trending?api_key=${apiKey}&limit=30&rating=g`;

  const res = await fetch(endpoint, { next: { revalidate: 60 } });
  if (!res.ok) return NextResponse.json({ data: [] }, { status: res.status });

  const json = await res.json();
  const gifs = (json.data as GiphyGif[]).map((g) => ({
    id: g.id,
    preview: g.images.fixed_height.url,
    original: g.images.original.url,
  }));

  return NextResponse.json({ data: gifs });
}
