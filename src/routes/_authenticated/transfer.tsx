import { useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Cloud,
  Download,
  Link2,
  Loader2,
  Radio,
  Upload,
  Wifi,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  downloadBlob,
  formatBytes,
  randomCode,
  receiveNearby,
  sendNearby,
  uploadTransferCloud,
  type TransferProgress,
} from "@/lib/fileTransfer";

export const Route = createFileRoute("/_authenticated/transfer")({
  head: () => ({
    meta: [
      { title: "Transfer — XUPPIN" },
      {
        name: "description",
        content: "Send large files nearby on Wi‑Fi or via a download link.",
      },
    ],
  }),
  component: TransferPage,
});

type Mode = "home" | "nearby-send" | "nearby-recv" | "cloud";

function TransferPage() {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>("home");
  const [file, setFile] = useState<File | null>(null);
  const [code, setCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState<TransferProgress | null>(null);
  const [busy, setBusy] = useState(false);
  const [cloudUrl, setCloudUrl] = useState<string | null>(null);

  function resetSoft() {
    setStatus("");
    setProgress(null);
    setBusy(false);
    setCloudUrl(null);
  }

  async function startNearbySend() {
    if (!file) {
      toast.error("Pick a file first");
      return;
    }
    const c = randomCode(6);
    setCode(c);
    setMode("nearby-send");
    setBusy(true);
    setStatus("Starting…");
    try {
      await sendNearby(
        c,
        file,
        (p) => setProgress(p),
        (s) => setStatus(s),
      );
      toast.success("File sent");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Send failed");
      setStatus(err instanceof Error ? err.message : "Send failed");
    } finally {
      setBusy(false);
    }
  }

  async function startNearbyRecv() {
    const c = joinCode.trim().toUpperCase();
    if (c.length < 4) {
      toast.error("Enter the code from the sender");
      return;
    }
    setMode("nearby-recv");
    setBusy(true);
    setStatus("Connecting…");
    try {
      const result = await receiveNearby(
        c,
        (p) => setProgress(p),
        (s) => setStatus(s),
      );
      downloadBlob(result.blob, result.name);
      toast.success(`Saved ${result.name}`);
      setStatus("Done — check your downloads");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Receive failed");
      setStatus(err instanceof Error ? err.message : "Receive failed");
    } finally {
      setBusy(false);
    }
  }

  async function startCloud() {
    if (!file || !user) {
      toast.error("Pick a file and stay signed in");
      return;
    }
    setMode("cloud");
    setBusy(true);
    setCloudUrl(null);
    setStatus("Uploading…");
    try {
      const result = await uploadTransferCloud(user.id, file, (p) =>
        setProgress(p),
      );
      setCloudUrl(result.url);
      setStatus("Link ready (valid 7 days)");
      toast.success("Upload complete");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
      setStatus(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <PageHeader
        title="Transfer"
        action={
          <Button asChild variant="ghost" size="sm">
            <Link to="/chats">
              <ArrowLeft className="h-4 w-4" />
              Chats
            </Link>
          </Button>
        }
      />

      <div className="space-y-4 p-4 pb-10">
        <p className="text-sm text-muted-foreground">
          Send big files like Xender (uses your Gaming Supabase for link + nearby signaling):{" "}
          <strong className="text-foreground">Nearby</strong> on the same Wi‑Fi
          (fast, large), or{" "}
          <strong className="text-foreground">Link</strong> over the internet
          (max ~5GB).
        </p>

        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            resetSoft();
            e.target.value = "";
          }}
        />

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex w-full flex-col items-center gap-2 rounded-2xl border border-dashed border-primary/40 bg-primary/5 px-4 py-8"
        >
          <Upload className="h-8 w-8 text-primary" />
          <span className="text-sm font-medium">
            {file ? file.name : "Choose a file"}
          </span>
          {file ? (
            <span className="text-xs text-muted-foreground">
              {formatBytes(file.size)}
            </span>
          ) : null}
        </button>

        {mode === "home" || !busy ? (
          <div className="grid gap-3">
            <Button
              className="w-full justify-start gap-3"
              disabled={!file || busy}
              onClick={() => void startNearbySend()}
            >
              <Wifi className="h-5 w-5" />
              <span className="text-left">
                <span className="block font-semibold">Send nearby</span>
                <span className="block text-xs font-normal opacity-80">
                  Same Wi‑Fi · large files · code to receiver
                </span>
              </span>
            </Button>

            <div className="rounded-2xl border border-border bg-card p-3">
              <p className="mb-2 flex items-center gap-2 text-sm font-medium">
                <Radio className="h-4 w-4 text-primary" />
                Receive nearby
              </p>
              <div className="flex gap-2">
                <Input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="Enter code"
                  className="uppercase tracking-widest"
                  maxLength={8}
                />
                <Button
                  disabled={busy}
                  onClick={() => void startNearbyRecv()}
                >
                  Join
                </Button>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full justify-start gap-3"
              disabled={!file || busy}
              onClick={() => void startCloud()}
            >
              <Cloud className="h-5 w-5" />
              <span className="text-left">
                <span className="block font-semibold">Send as link</span>
                <span className="block text-xs font-normal opacity-80">
                  Internet · up to 5GB · 7‑day link
                </span>
              </span>
            </Button>
          </div>
        ) : null}

        {(busy || status || progress || cloudUrl) && (
          <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
            {code && mode === "nearby-send" ? (
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Share this code</p>
                <p className="text-3xl font-bold tracking-[0.3em] text-primary">
                  {code}
                </p>
              </div>
            ) : null}

            {status ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {status}
              </p>
            ) : null}

            {progress ? (
              <div>
                <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                  <span>
                    {formatBytes(progress.sent)} / {formatBytes(progress.total)}
                  </span>
                  <span>{progress.pct}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${progress.pct}%` }}
                  />
                </div>
              </div>
            ) : null}

            {cloudUrl ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground break-all">
                  {cloudUrl}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(cloudUrl);
                        toast.success("Link copied");
                      } catch {
                        toast.error("Could not copy");
                      }
                    }}
                  >
                    <Link2 className="h-4 w-4" />
                    Copy link
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <a href={cloudUrl} target="_blank" rel="noreferrer">
                      <Download className="h-4 w-4" />
                      Open
                    </a>
                  </Button>
                </div>
              </div>
            ) : null}

            {!busy ? (
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => {
                  setMode("home");
                  resetSoft();
                  setCode("");
                }}
              >
                Back
              </Button>
            ) : null}
          </div>
        )}
      </div>
    </AppShell>
  );
}
