import Link from "next/link";
import { cn } from "@/lib/utils";

type LogoProps = {
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "default" | "white";
  compact?: boolean;
  asLink?: boolean;
  className?: string;
};

const sizeMap = {
  sm: { full: "text-lg", compact: "text-base" },
  md: { full: "text-xl", compact: "text-lg" },
  lg: { full: "text-3xl", compact: "text-2xl" },
  xl: { full: "text-5xl", compact: "text-4xl" },
};

export function Logo({
  size = "md",
  variant = "default",
  compact = false,
  asLink = false,
  className,
}: LogoProps) {
  const { full, compact: compactSize } = sizeMap[size];

  const content = compact ? (
    <span className={cn("tracking-tight select-none font-black", compactSize, className)}>
      <span className={variant === "white" ? "text-white/80" : "text-[var(--foreground)]"}>L</span>
      <span className={variant === "white" ? "text-white" : "text-[var(--accent)]"}>T</span>
    </span>
  ) : (
    <span className={cn("tracking-tight select-none", full, className)}>
      <span className={cn("font-semibold", variant === "white" ? "text-white/80" : "text-[var(--foreground)]")}>
        Let&apos;s{" "}
      </span>
      <span className={cn("font-black", variant === "white" ? "text-white" : "text-[var(--accent)]")}>
        Tweet
      </span>
    </span>
  );

  if (asLink) {
    return (
      <Link href="/" className="flex items-center rounded-full hover:bg-[var(--hover)] transition-colors w-fit px-3 py-3">
        {content}
      </Link>
    );
  }

  return content;
}
