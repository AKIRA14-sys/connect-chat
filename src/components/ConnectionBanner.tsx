import { useEffect, useState } from "react";
import { CloudOff, RefreshCw } from "lucide-react";

export function useOnlineStatus() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);
  return online;
}

export function ConnectionBanner({ reconnecting }: { reconnecting?: boolean }) {
  const online = useOnlineStatus();
  if (online && !reconnecting) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center px-3 pt-[max(0.5rem,env(safe-area-inset-top))]">
      <div className="flex items-center gap-2 rounded-full bg-surface-2 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-panel">
        {online ? (
          <>
            <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Reconnecting…
          </>
        ) : (
          <>
            <CloudOff className="h-3.5 w-3.5" /> You're offline — showing saved messages
          </>
        )}
      </div>
    </div>
  );
}
