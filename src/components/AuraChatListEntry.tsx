import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { useIsAdmin } from "@/hooks/useProfile";

export function AuraChatListEntry() {
  const { data: isAdmin } = useIsAdmin();
  if (!isAdmin) return null;

  return (
    <Link
      to="/aura"
      className="mx-2 mb-1 flex items-center gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-3 transition hover:bg-emerald-500/15"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
        <Sparkles className="h-6 w-6 text-emerald-300" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-semibold text-white">AURA</p>
          <span className="rounded bg-emerald-500/25 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-300">
            Admin
          </span>
        </div>
        <p className="truncate text-xs text-slate-400">
          Your admin assistant — tap to chat
        </p>
      </div>
    </Link>
  );
}
