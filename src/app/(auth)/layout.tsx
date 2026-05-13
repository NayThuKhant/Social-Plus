import { Logo } from "@/components/shared/Logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex">
      {/* Left panel - branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-[var(--accent)] items-center justify-center">
        <div className="text-white text-center">
          <Logo size="xl" variant="white" className="mb-6 block" />
          <h1 className="text-4xl font-bold">Happening now</h1>
          <p className="text-xl mt-2 opacity-90">Join the conversation today.</p>
        </div>
      </div>

      {/* Right panel - form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
