import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Coins, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useIsAdmin } from "@/hooks/useProfile";
import { auraChat, getAuraStatus, type AuraMessage } from "@/lib/aura.functions";
import {
  getAdminUnlimitedCoins,
  setAdminUnlimitedCoins,
} from "@/lib/adminCoins.functions";

export const Route = createFileRoute("/_authenticated/aura")({
  head: () => ({
    meta: [{ title: "AURA — XUPPIN" }],
  }),
  component: AuraPage,
});

type Line = { role: "user" | "assistant"; content: string; imageUrl?: string | null };

function AuraPage() {
  const navigate = useNavigate();
  const { data: isAdmin, isLoading: adminLoading } = useIsAdmin();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<Line[]>([
    {
      role: "assistant",
      content:
        "Hey — I'm AURA. Chat normally. Text uses Groq; images/themes/badges design use OpenRouter. Try: “list shop”, “turn unlimited coins on”, or “design a fire badge”.",
    },
  ]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: status, refetch: refetchStatus } = useQuery({
    queryKey: ["aura-status"],
    enabled: !!isAdmin,
    queryFn: () => getAuraStatus(),
  });

  const { data: coinState, refetch: refetchCoins } = useQuery({
    queryKey: ["admin-unlimited-coins"],
    enabled: !!isAdmin,
    queryFn: () => getAdminUnlimitedCoins(),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines, busy]);

  async function toggleCoins(enabled: boolean) {
    try {
      const res = await setAdminUnlimitedCoins({ data: { enabled } });
      toast.success(res.message);
      await refetchCoins();
      await refetchStatus();
      setLines((L) => [
        ...L,
        {
          role: "assistant",
          content: enabled
            ? "Unlimited coins are ON. You can test buys and send coins from your high balance. Turn OFF anytime to restore your old balance."
            : "Unlimited coins OFF. Your previous balance is restored. Other users never saw this switch.",
        },
      ]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  async function send() {
    const msg = text.trim();
    if (!msg || busy) return;
    setText("");
    const nextLines: Line[] = [...lines, { role: "user", content: msg }];
    setLines(nextLines);
    setBusy(true);
    try {
      const payload: AuraMessage[] = nextLines.map((l) => ({
        role: l.role,
        content: l.content,
      }));
      const res = await auraChat({ data: { messages: payload } });
      setLines((L) => [
        ...L,
        {
          role: "assistant",
          content: res.reply,
          imageUrl: res.imageUrl || null,
        },
      ]);
      if (res.tool?.startsWith("unlimited")) {
        await refetchCoins();
        await refetchStatus();
      }
    } catch (e) {
      setLines((L) => [
        ...L,
        {
          role: "assistant",
          content: e instanceof Error ? e.message : "Something went wrong",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  if (adminLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center app-gradient">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 app-gradient px-6 text-center">
        <h1 className="text-xl font-semibold">AURA is admin-only</h1>
        <p className="text-sm text-muted-foreground">
          Later AURA can help everyone. For now only the master admin can open this chat.
        </p>
        <Button onClick={() => void navigate({ to: "/chats" })}>Back to chats</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[100dvh] w-full max-w-lg flex-col app-gradient">
      <header className="flex items-center gap-2 border-b border-border/60 bg-background/90 px-2 py-2 backdrop-blur safe-top">
        <Button
          size="icon"
          variant="ghost"
          onClick={() => void navigate({ to: "/chats" })}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">AURA</p>
          <p className="truncate text-[11px] text-muted-foreground">
            Admin assistant
            {status?.hasGroq ? " · Groq on" : " · Groq key missing"}
            {status?.hasOpenRouter ? " · OpenRouter on" : ""}
          </p>
        </div>
      </header>

      <div className="flex items-center justify-between gap-2 border-b border-border/40 px-3 py-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Coins className="h-4 w-4" />
          Unlimited coins
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="aura-coins" className="text-xs">
            {coinState?.enabled ? "ON" : "OFF"}
          </Label>
          <Switch
            id="aura-coins"
            checked={Boolean(coinState?.enabled)}
            onCheckedChange={(v) => void toggleCoins(v)}
          />
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {lines.map((line, i) => (
          <div
            key={i}
            className={`flex ${line.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                line.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border"
              }`}
            >
              {line.content}
              {line.imageUrl ? (
                <img
                  src={line.imageUrl}
                  alt=""
                  className="mt-2 max-h-48 w-full rounded-xl object-cover"
                />
              ) : null}
            </div>
          </div>
        ))}
        {busy ? (
          <p className="text-xs text-muted-foreground">AURA is typing…</p>
        ) : null}
        <div ref={bottomRef} />
      </div>

      <form
        className="flex gap-2 border-t border-border/60 bg-background/90 p-2 safe-bottom"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message AURA…"
          disabled={busy}
        />
        <Button type="submit" size="icon" disabled={busy || !text.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
