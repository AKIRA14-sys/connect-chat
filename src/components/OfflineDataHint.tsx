import { useOnlineStatus } from "@/components/ConnectionBanner";

export function OfflineDataHint({ label = "this section" }: { label?: string }) {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div className="mx-3 my-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
      Offline on this phone. You can still move around. Saved {label} appears if
      you opened it here while online.
    </div>
  );
}
