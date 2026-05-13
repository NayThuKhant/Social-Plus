import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { MainLayoutClient } from "@/components/layout/MainLayoutClient";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { passwordHash, ...safeUser } = user;
  void passwordHash;

  return <MainLayoutClient user={safeUser}>{children}</MainLayoutClient>;
}
