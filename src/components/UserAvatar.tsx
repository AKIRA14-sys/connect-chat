import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { initials, signedUrl } from "@/lib/whatsxup";

type Props = {
  path?: string | null;
  name: string;
  size?: "sm" | "md" | "lg" | "xl";
  bucket?: "avatars" | "chat-media";
  online?: boolean;
  className?: string;
};

const sizes = {
  sm: "h-9 w-9 text-xs",
  md: "h-12 w-12 text-sm",
  lg: "h-16 w-16 text-lg",
  xl: "h-28 w-28 text-3xl",
};

export function UserAvatar({ path, name, size = "md", bucket = "avatars", online, className }: Props) {
  const { data: url } = useQuery({
    queryKey: ["signed", bucket, path],
    queryFn: () => signedUrl(bucket, path ?? null),
    enabled: !!path,
    staleTime: 50 * 60 * 1000,
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
          <img src={url} alt={name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <span>{initials(name || "?")}</span>
        )}
      </div>
      {online !== undefined && (
        <span
          className={cn(
            "absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background",
            online ? "bg-success" : "bg-muted-foreground/50",
          )}
        />
      )}
    </div>
  );
}
