import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  getPermissionStatus,
  requestPermission,
  type PermKey,
  type PermState,
} from "@/lib/native/permissions";
import {
  isBiometricAvailable,
  isBiometricEnabled,
  setBiometricEnabled,
} from "@/lib/native/biometrics";
import { isHapticsEnabled, setHapticsEnabled } from "@/lib/native/haptics";
import {
  getAutoDownload,
  setAutoDownload,
  getSaveToGallery,
  setSaveToGallery,
  getDownloadBeforeView,
  setDownloadBeforeView,
  getCacheLimitMb,
  setCacheLimitMb,
  type AutoDownloadKind,
  type NetworkBucket,
} from "@/lib/native/mediaSettings";
import { isAndroid, isNative } from "@/lib/native/platform";
import { initNativePush } from "@/lib/native/pushNative";
import { saveFcmToken } from "@/lib/push.functions";

const PERMS: { key: PermKey; label: string }[] = [
  { key: "notifications", label: "Notifications" },
  { key: "camera", label: "Camera" },
  { key: "microphone", label: "Microphone" },
  { key: "photos", label: "Photos & videos" },
];

function statusLabel(s: PermState) {
  if (s === "granted") return "Allowed";
  if (s === "denied") return "Not allowed";
  if (s === "unsupported") return "Web only";
  return "Ask when needed";
}

export function AndroidSettingsPanel() {
  const [states, setStates] = useState<Record<string, PermState>>({});
  const [bioAvail, setBioAvail] = useState(false);
  const [bioOn, setBioOn] = useState(isBiometricEnabled());
  const [haptics, setHaptics] = useState(isHapticsEnabled());
  const [gallery, setGallery] = useState(getSaveToGallery());
  const [beforeView, setBeforeView] = useState(getDownloadBeforeView());
  const [cacheMb, setCacheMb] = useState(getCacheLimitMb());

  async function refresh() {
    const next: Record<string, PermState> = {};
    for (const p of PERMS) {
      next[p.key] = await getPermissionStatus(p.key);
    }
    setStates(next);
    setBioAvail(await isBiometricAvailable());
  }

  useEffect(() => {
    void refresh();
  }, []);

  const kinds: AutoDownloadKind[] = ["photos", "videos", "documents", "voice"];
  const nets: NetworkBucket[] = ["wifi", "mobile"];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {isNative()
          ? isAndroid()
            ? "Running inside the Android APK — native features enabled."
            : "Native platform detected."
          : "Running as web/PWA — some Android features need the APK."}
      </p>

      <section className="space-y-2 rounded-2xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold">Permissions</h3>
        {PERMS.map((p) => (
          <div
            key={p.key}
            className="flex items-center justify-between gap-2 py-1 text-sm"
          >
            <span>{p.label}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {statusLabel(states[p.key] || "prompt")}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={async () => {
                  const s = await requestPermission(p.key);
                  setStates((prev) => ({ ...prev, [p.key]: s }));
                  if (s === "granted" && p.key === "notifications") {
                    await initNativePush(async (token) => {
                      try {
                        await saveFcmToken({ data: { token } });
                      } catch (err) {
                        console.error("[push] failed to save FCM token", err);
                      }
                    });
                    toast.success("Notifications enabled");
                  }
                }}
              >
                Allow
              </Button>
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-2 rounded-2xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold">App lock</h3>
        <label className="flex items-center justify-between text-sm">
          <span>Use biometrics when available</span>
          <input
            type="checkbox"
            checked={bioOn}
            disabled={!bioAvail}
            onChange={(e) => {
              setBiometricEnabled(e.target.checked);
              setBioOn(e.target.checked);
              toast.success(
                e.target.checked ? "Biometrics preferred" : "PIN only",
              );
            }}
          />
        </label>
        {!bioAvail ? (
          <p className="text-xs text-muted-foreground">
            Biometrics not available on this device/browser. PIN lock still
            works.
          </p>
        ) : null}
      </section>

      <section className="space-y-2 rounded-2xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold">Haptics</h3>
        <label className="flex items-center justify-between text-sm">
          <span>Vibration feedback</span>
          <input
            type="checkbox"
            checked={haptics}
            onChange={(e) => {
              setHapticsEnabled(e.target.checked);
              setHaptics(e.target.checked);
            }}
          />
        </label>
      </section>

      <section className="space-y-2 rounded-2xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold">Media & storage</h3>
        <label className="flex items-center justify-between text-sm">
          <span>Save received media to Gallery</span>
          <input
            type="checkbox"
            checked={gallery}
            onChange={(e) => {
              setSaveToGallery(e.target.checked);
              setGallery(e.target.checked);
            }}
          />
        </label>
        <label className="flex items-center justify-between text-sm">
          <span>Download before viewing</span>
          <input
            type="checkbox"
            checked={beforeView}
            onChange={(e) => {
              setDownloadBeforeView(e.target.checked);
              setBeforeView(e.target.checked);
            }}
          />
        </label>
        <Label>Cache limit (MB)</Label>
        <select
          className="w-full rounded-md border border-border bg-background px-2 py-2 text-sm"
          value={cacheMb}
          onChange={(e) => {
            const v = Number(e.target.value);
            setCacheLimitMb(v);
            setCacheMb(v);
          }}
        >
          {[250, 500, 1024, 2048].map((n) => (
            <option key={n} value={n}>
              {n >= 1024 ? `${n / 1024} GB` : `${n} MB`}
            </option>
          ))}
        </select>
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold">Auto-download</h3>
        {nets.map((net) => (
          <div key={net} className="space-y-1">
            <p className="text-xs font-medium uppercase text-muted-foreground">
              {net === "wifi" ? "Wi-Fi" : "Mobile data"}
            </p>
            {kinds.map((kind) => (
              <label
                key={`${net}-${kind}`}
                className="flex items-center justify-between text-sm capitalize"
              >
                <span>{kind}</span>
                <input
                  type="checkbox"
                  checked={getAutoDownload(net, kind)}
                  onChange={(e) => {
                    setAutoDownload(net, kind, e.target.checked);
                    toast.message("Saved");
                  }}
                />
              </label>
            ))}
          </div>
        ))}
      </section>
    </div>
  );
}