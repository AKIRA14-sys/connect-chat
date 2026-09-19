import { useEffect, useState } from "react";
import { CloudOff, RefreshCw } from "lucide-react";

export function useOnlineStatus() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(typeof navigator !== "undefined" ? navigator.onLine : true);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

/** Banner on this phone when offline — you can still read saved chats. */
export function ConnectionBanner({ reconnecting }: { reconnecting?: boolean }) {
  const online = useOnlineStatus();
  if (online && !reconnecting) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center px-3 pt-[max(0.5rem,env(safe-area-inset-top))]">
      <div className="flex max-w-md items-center gap-2 rounded-full bg-zinc-900/95 px-3 py-1.5 text-xs font-medium text-zinc-100 shadow-lg ring-1 ring-white/10">
        {online ? (
          <>
            <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin" />
            Back online — updating…
          </>
        ) : (
          <>
            <CloudOff className="h-3.5 w-3.5 shrink-0" />
            <span>
              Offline on this phone — showing chats you opened before while
              online.
            </span>
          </>
        )}
      </div>
    </div>
  );
}

export function OfflineChip() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
      <CloudOff className="h-3 w-3" /> Offline
    </span>
  );
}
