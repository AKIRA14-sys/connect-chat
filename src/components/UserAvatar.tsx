import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { initials, signedUrl } from "@/lib/whatsxup";
import { getPublicGamingProfile } from "@/lib/gaming.functions";

type Props = {
  path?: string | null;
  name: string;
  size?: "sm" | "md" | "lg" | "xl";
  bucket?: "avatars" | "chat-media";
  online?: boolean;
  className?: string;
  /** Optional: show public gaming level badge */
  userId?: string | null;
  showGamingLevel?: boolean;
};

const sizes = {
  sm: "h-9 w-9 text-xs",
  md: "h-12 w-12 text-sm",
  lg: "h-16 w-16 text-lg",
  xl: "h-28 w-28 text-3xl",
};

const badgeSizes = {
  sm: "min-w-[1.1rem] px-0.5 text-[8px]",
  md: "min-w-[1.25rem] px-1 text-[9px]",
  lg: "min-w-[1.4rem] px-1 text-[10px]",
  xl: "min-w-[1.6rem] px-1.5 text-[11px]",
};

export function UserAvatar({
  path,
  name,
  size = "md",
  bucket = "avatars",
  online,
  className,
  userId,
  showGamingLevel = false,
}: Props) {
  const { data: url } = useQuery({
    queryKey: ["signed", bucket, path],
    queryFn: () => signedUrl(bucket, path ?? null),
    enabled: Boolean(path),
    staleTime: 50 * 60 * 1000,
  });

  const { data: level } = useQuery({
    queryKey: ["public-gaming-level", userId],
    enabled: Boolean(showGamingLevel && userId),
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<number | null> => {
      if (!userId) return null;
      try {
        const res: unknown = await getPublicGamingProfile({
          data: { userId },
        });
        if (!res || typeof res !== "object") return null;
        const root = res as Record<string, unknown>;
        const profile =
          root.profile && typeof root.profile === "object"
            ? (root.profile as Record<string, unknown>)
            : root;
        const n = Number(profile.current_level ?? profile.level);
        return Number.isFinite(n) && n > 0 ? n : null;
      } catch {
        return null;
      }
    },
  });

  return (
    <div className={cn("relative shrink-0", className)}>
      <div
        className={cn(
          "flex items-center justify-center overflow-hidden rounded-full bg-surface-2 font-semibold text-muted-foreground",
          sizes[size],
        )}
      >
        {url ? (
          <img
            src={url}
            alt={name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <span>{initials(name || "?")}</span>
        )}
      </div>
      {online !== undefined ? (
        <span
          className={cn(
            "absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background",
            online ? "bg-success" : "bg-muted-foreground/50",
          )}
        />
      ) : null}
      {showGamingLevel && level != null ? (
        <span
          className={cn(
            "absolute -bottom-0.5 -left-0.5 rounded-full border border-background bg-amber-500 font-bold text-black shadow",
            badgeSizes[size],
          )}
          title={`Level ${level}`}
        >
          {level}
        </span>
      ) : null}
    </div>
  );
}
