import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { useIsAdmin } from "@/hooks/useProfile";

/**
 * Pin AURA at the top of the chat list for admins only.
 * Paste near the top of the chats list UI:
 *   import { AuraChatListEntry } from "@/components/AuraChatListEntry";
 *   ...
 *   <AuraChatListEntry />
 */
export function AuraChatListEntry() {
  const { data: isAdmin } = useIsAdmin();
  if (!isAdmin) return null;

  return (
    <Link
      to="/aura"
      className="flex items-center gap-3 border-b border-border/50 px-4 py-3 transition hover:bg-muted/40"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20">
        <Sparkles className="h-6 w-6 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate font-semibold">AURA</p>
          <span className="text-[10px] uppercase tracking-wide text-primary">
            Admin
          </span>
        </div>
        <p className="truncate text-xs text-muted-foreground">
          Your admin assistant — tap to chat
        </p>
      </div>
    </Link>
  );
}
