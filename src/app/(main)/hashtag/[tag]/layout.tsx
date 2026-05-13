import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ tag: string }> }): Promise<Metadata> {
  const { tag } = await params;
  return { title: `#${tag}` };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
