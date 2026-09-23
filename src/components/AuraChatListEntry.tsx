import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { useIsAdmin } from "@/hooks/useProfile";

/**
 * Pin AURA at the top of the chat list (admins).
 * Visual matches XUPPIN home mock: glow avatar + ADMIN pill.
 */
export function AuraChatListEntry() {
  const { data: isAdmin } = useIsAdmin();
  if (!isAdmin) return null;

  return (
    <li className="list-none">
      <Link
        to="/aura"
        className="mx-2 mb-1 flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 via-sky-500/5 to-transparent px-3 py-3 transition hover:border-emerald-400/30 hover:from-emerald-500/15"
      >
        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400/30 to-sky-500/20 ring-2 ring-emerald-400/40">
          <Sparkles className="h-6 w-6 text-emerald-300" />
          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#0a0e1a] bg-emerald-400" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-semibold text-white">AURA</p>
            <span className="rounded-md bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
              Admin
            </span>
          </div>
          <p className="truncate text-xs text-slate-400">
            Your admin assistant — tap to chat
          </p>
        </div>
        <span className="text-xs text-slate-500">›</span>
      </Link>
    </li>
  );
}
