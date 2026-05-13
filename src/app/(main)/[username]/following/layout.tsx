import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  return { title: `Following · @${username}` };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
