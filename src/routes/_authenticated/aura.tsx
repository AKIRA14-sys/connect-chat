import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Coins, Send, Sparkles, Trash2 } from "lucide-react";
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
import {
  adminListContactsForAura,
  adminSendDirectMessage,
} from "@/lib/adminMessage.functions";

export const Route = createFileRoute("/_authenticated/aura")({
  head: () => ({
    meta: [{ title: "AURA — XUPPIN" }],
  }),
  component: AuraPage,
});

type Line = {
  role: "user" | "assistant";
  content: string;
  imageUrl?: string | null;
};

const MEMORY_KEY = "xuppin_aura_chat_v1";
const MAX_STORED = 80;

const DEFAULT_LINES: Line[] = [
  {
    role: "assistant",
    content:
      "Hey — I'm AURA, your XUPPIN admin co-pilot.\n\nI know the app: Chats, Groups, Shop, Games, XUP, Settings, Control Room.\n\nTry:\n• list shop  (full catalog, every item)\n• design a fire theme\n• implement it\n• unlimited coins on/off\n• hide ITEM / show ITEM\n\nYour chat with me is saved on this device so you can leave and come back.",
  },
];

function loadMemory(): Line[] {
  if (typeof window === "undefined") return DEFAULT_LINES;
  try {
    const raw = localStorage.getItem(MEMORY_KEY);
    if (!raw) return DEFAULT_LINES;
    const parsed = JSON.parse(raw) as Line[];
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_LINES;
    return parsed.slice(-MAX_STORED);
  } catch {
    return DEFAULT_LINES;
  }
}

function saveMemory(lines: Line[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      MEMORY_KEY,
      JSON.stringify(lines.slice(-MAX_STORED)),
    );
  } catch {
    /* quota */
  }
}

function AuraPage() {
  const navigate = useNavigate();
  const { data: isAdmin, isLoading: adminLoading } = useIsAdmin();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<Line[]>(DEFAULT_LINES);
  const [hydrated, setHydrated] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [atOpen, setAtOpen] = useState(false);
  const [atFilter, setAtFilter] = useState("");
  const [picked, setPicked] = useState<{
    id: string;
    label: string;
  } | null>(null);

  const { data: contactData } = useQuery({
    queryKey: ["aura-contacts"],
    enabled: !!isAdmin,
    queryFn: () => adminListContactsForAura(),
  });
  const contacts = contactData?.contacts ?? [];
  const filteredContacts = contacts.filter((c) => {
    const q = atFilter.toLowerCase();
    if (!q) return true;
    return (
      (c.username || "").toLowerCase().includes(q) ||
      (c.display_name || "").toLowerCase().includes(q)
    );
  });

  useEffect(() => {
    setLines(loadMemory());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveMemory(lines);
  }, [lines, hydrated]);

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
            ? "Unlimited coins ON (admin only). Turn off anytime to restore your previous balance."
            : "Unlimited coins OFF. Previous balance restored.",
        },
      ]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  function clearMemory() {
    setLines(DEFAULT_LINES);
    saveMemory(DEFAULT_LINES);
    toast.message("AURA memory cleared on this device");
  }

  async function send() {
    const msg = text.trim();
    if (!msg || busy) return;

    // Admin send to contact: "send ..." with picked contact, or "message @user: hello"
    const sendMatch = msg.match(/^(?:send|message|msg)\s+(.+)$/i);
    if (picked && sendMatch) {
      setText("");
      setBusy(true);
      try {
        const body = sendMatch[1].replace(/^@\S+\s*/, "").trim() || sendMatch[1];
        const res = await adminSendDirectMessage({
          data: { recipientId: picked.id, text: body },
        });
        setLines((L) => [
          ...L,
          { role: "user", content: msg },
          {
            role: "assistant",
            content: `Sent to ${picked.label}: "${body}"`,
          },
        ]);
        toast.success(res.message);
      } catch (e) {
        setLines((L) => [
          ...L,
          { role: "user", content: msg },
          {
            role: "assistant",
            content: e instanceof Error ? e.message : "Send failed",
          },
        ]);
      } finally {
        setBusy(false);
      }
      return;
    }

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
            XUPPIN admin co-pilot
            {status?.hasGroq ? " · Groq on" : " · Groq key missing"}
            {status?.hasOpenRouter ? " · OpenRouter on" : ""}
          </p>
        </div>
        <Button size="icon" variant="ghost" title="Clear memory" onClick={clearMemory}>
          <Trash2 className="h-4 w-4" />
        </Button>
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
        className="relative flex gap-2 border-t border-border/60 bg-background/90 p-2 safe-bottom"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        {atOpen ? (
          <div className="absolute bottom-14 left-2 right-14 z-20 max-h-40 overflow-y-auto rounded-xl border border-border bg-card shadow-lg">
            {filteredContacts.length === 0 ? (
              <p className="p-2 text-xs text-muted-foreground">No contacts</p>
            ) : (
              filteredContacts.slice(0, 30).map((c) => {
                const label =
                  c.display_name ||
                  (c.username ? `@${c.username}` : c.id.slice(0, 8));
                return (
                  <button
                    key={c.id}
                    type="button"
                    className="flex w-full px-3 py-2 text-left text-sm hover:bg-muted/50"
                    onClick={() => {
                      setPicked({ id: c.id, label });
                      setAtOpen(false);
                      setText((t) => {
                        const i = t.lastIndexOf("@");
                        const base = i >= 0 ? t.slice(0, i) : t;
                        return `${base}@${c.username || label} `;
                      });
                      setAtFilter("");
                    }}
                  >
                    {label}
                    {c.username ? (
                      <span className="ml-1 text-xs text-muted-foreground">
                        @{c.username}
                      </span>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        ) : null}
        <Input
          value={text}
          onChange={(e) => {
            const v = e.target.value;
            setText(v);
            const at = v.lastIndexOf("@");
            if (at >= 0 && !v.slice(at + 1).includes(" ")) {
              setAtOpen(true);
              setAtFilter(v.slice(at + 1));
            } else {
              setAtOpen(false);
            }
          }}
          placeholder={
            picked
              ? `Message ${picked.label} via AURA…`
              : "Message AURA… (@ to pick contact)"
          }
          disabled={busy}
        />
        <Button type="submit" size="icon" disabled={busy || !text.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
