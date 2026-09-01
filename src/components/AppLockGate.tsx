import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  isAppLockEnabled,
  hasPinSet,
  isUnlocked,
  unlockWithPin,
  shouldRelockFromBackground,
  lockNow,
  touchActivity,
} from "@/lib/appLock";

/**
 * Full-screen PIN gate when app lock is enabled.
 * Place inside authenticated shell (e.g. root providers).
 */
export function AppLockGate({ children }: { children: React.ReactNode }) {
  const [locked, setLocked] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const sync = () => {
      if (!isAppLockEnabled() || !hasPinSet()) {
        setLocked(false);
        return;
      }
      if (shouldRelockFromBackground()) {
        lockNow();
      }
      setLocked(!isUnlocked());
    };

    sync();

    const onVis = () => {
      if (document.visibilityState === "hidden") {
        touchActivity();
      } else {
        sync();
      }
    };

    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", sync);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", sync);
    };
  }, []);

  useEffect(() => {
    if (!locked) touchActivity();
  }, [locked]);

  if (!locked) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-4 bg-background px-6">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/15">
        <Lock className="h-7 w-7 text-primary" />
      </div>
      <h1 className="text-lg font-semibold">XUPPIN is locked</h1>
      <p className="text-center text-sm text-muted-foreground">
        Enter your PIN to open chats
      </p>
      <Input
        type="password"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={8}
        value={pin}
        onChange={(e) => {
          setPin(e.target.value.replace(/\D/g, ""));
          setError("");
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            if (unlockWithPin(pin)) {
              setPin("");
              setLocked(false);
            } else {
              setError("Wrong PIN");
              setPin("");
            }
          }
        }}
        className="max-w-[200px] text-center text-lg tracking-[0.4em]"
        placeholder="••••"
        autoFocus
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button
        className="min-w-[160px]"
        onClick={() => {
          if (unlockWithPin(pin)) {
            setPin("");
            setLocked(false);
          } else {
            setError("Wrong PIN");
            setPin("");
          }
        }}
      >
        Unlock
      </Button>
    </div>
  );
}
