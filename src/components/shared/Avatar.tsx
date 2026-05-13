import Link from "next/link";
import { cn } from "@/lib/utils";

type AvatarProps = {
  src?: string | null;
  alt: string;
  username?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
};

const sizes = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 48,
  xl: 80,
};

function AvatarImage({ src, alt, size = "md", className }: AvatarProps) {
  const px = sizes[size];
  return (
    <div
      className={cn(
        "rounded-full overflow-hidden bg-[var(--border)] flex-shrink-0",
        className
      )}
      style={{ width: px, height: px }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="object-cover w-full h-full" />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-[var(--accent)] text-white font-bold text-sm">
          {alt.charAt(0).toUpperCase()}
        </div>
      )}
    </div>
  );
}

export function Avatar({ src, alt, username, size = "md", className }: AvatarProps) {
  if (username) {
    return (
      <Link href={`/${username}`} className="flex-shrink-0">
        <AvatarImage src={src} alt={alt} size={size} className={className} />
      </Link>
    );
  }
  return <AvatarImage src={src} alt={alt} size={size} className={className} />;
}
