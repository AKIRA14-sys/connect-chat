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
  userId?: string | null;
  showGamingLevel?: boolean;
};

const sizes = {
  sm: "h-9 w-9 text-xs",
  md: "h-12 w-12 text-sm",
  lg: "h-16 w-16 text-lg",
  xl: "h-28 w-28 text-3xl",
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
    staleTime: 60 * 1000,
    queryFn: async (): Promise<number | null> => {
      if (!userId) return null;
      try {
        const res: unknown = await getPublicGamingProfile({
          data: { userId },
        });
        if (!res || typeof res !== "object") return null;

        const root = res as Record<string, unknown>;
        const profileRaw =
          root.profile ??
          root.data ??
          (root.current_level != null || root.level != null ? root : null);

        if (!profileRaw || typeof profileRaw !== "object") return null;

        const profile = profileRaw as Record<string, unknown>;
        const n = Number(
          profile.current_level ?? profile.level ?? profile.lvl ?? 0,
        );
        if (!Number.isFinite(n) || n < 1) return null;
        return n;
      } catch (err) {
        console.warn("[UserAvatar] gaming level load failed", userId, err);
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
            "absolute bottom-0 right-0 z-[1] h-3 w-3 rounded-full border-2 border-background",
            online ? "bg-success" : "bg-muted-foreground/50",
          )}
        />
      ) : null}
      {showGamingLevel && level != null ? (
        <span
          className="absolute -left-1 -top-1 z-[2] rounded-full border border-black/20 bg-amber-400 px-1.5 py-0.5 text-[9px] font-black leading-none text-black shadow-md"
          title={`Gaming level ${level}`}
        >
          Lv{level}
        </span>
      ) : null}
    </div>
  );
}
