import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Coins, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  getAdminUnlimitedCoins,
  setAdminUnlimitedCoins,
} from "@/lib/adminCoins.functions";
import {
  adminListShopCatalog,
  adminSetShopItemAvailable,
} from "@/lib/shopAdmin.functions";

type ChatLine = { role: "user" | "bot"; text: string };

/**
 * Admin-only: unlimited X coins toggle + simple command bot.
 * (No phone storage access — web/admin bot only.)
 */
export function AdminCoinsAndBotPanel() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const [lines, setLines] = useState<ChatLine[]>([
    {
      role: "bot",
      text: "Admin bot ready. Try: help · coins on · coins off · shop list · hide <item name>",
    },
  ]);

  const { data: coinState, refetch } = useQuery({
    queryKey: ["admin-unlimited-coins"],
    queryFn: () => getAdminUnlimitedCoins(),
  });

  async function toggleCoins(enabled: boolean) {
    setBusy(true);
    try {
      const res = await setAdminUnlimitedCoins({ data: { enabled } });
      toast.success(res.message);
      await refetch();
      void qc.invalidateQueries({ queryKey: ["gaming-wallet"] });
      setLines((L) => [
        ...L,
        {
          role: "bot",
          text: enabled
            ? "Unlimited coins ON. Balance set high so you can test shop buys."
            : "Unlimited coins OFF. Previous balance restored.",
        },
      ]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function runBot(command: string) {
    const cmd = command.trim();
    if (!cmd) return;
    setLines((L) => [...L, { role: "user", text: cmd }]);
    setInput("");
    const lower = cmd.toLowerCase();

    try {
      if (lower === "help" || lower === "?") {
        setLines((L) => [
          ...L,
          {
            role: "bot",
            text: [
              "Commands (admin only):",
              "• coins on / coins off — unlimited X coins",
              "• shop list — list shop items",
              "• hide <name> — hide item from shop",
              "• show <name> — show item again",
              "Phone storage is NOT available to this bot (browser security).",
            ].join("\n"),
          },
        ]);
        return;
      }

      if (lower === "coins on" || lower === "unlimited on") {
        await toggleCoins(true);
        return;
      }
      if (lower === "coins off" || lower === "unlimited off") {
        await toggleCoins(false);
        return;
      }

      if (lower === "shop list" || lower === "list shop") {
        const cat = await adminListShopCatalog();
        const items = cat.items || [];
        const text =
          items.length === 0
            ? "No shop items yet."
            : items
                .slice(0, 30)
                .map(
                  (i) =>
                    `• ${i.name} — ${i.price_x_coins} coins${i.available ? "" : " (hidden)"}`,
                )
                .join("\n");
        setLines((L) => [...L, { role: "bot", text }]);
        return;
      }

      if (lower.startsWith("hide ") || lower.startsWith("show ")) {
        const hide = lower.startsWith("hide ");
        const name = cmd.slice(5).trim().toLowerCase();
        const cat = await adminListShopCatalog();
        const item = (cat.items || []).find(
          (i) => i.name.toLowerCase() === name || i.name.toLowerCase().includes(name),
        );
        if (!item) {
          setLines((L) => [
            ...L,
            { role: "bot", text: `No item matching "${cmd.slice(5).trim()}"` },
          ]);
          return;
        }
        await adminSetShopItemAvailable({
          data: { itemId: item.item_id, available: !hide },
        });
        setLines((L) => [
          ...L,
          {
            role: "bot",
            text: hide
              ? `Hidden "${item.name}" from the shop.`
              : `Showing "${item.name}" in the shop again.`,
          },
        ]);
        void qc.invalidateQueries({ queryKey: ["admin-shop-catalog"] });
        return;
      }

      setLines((L) => [
        ...L,
        {
          role: "bot",
          text: "Unknown command. Type help",
        },
      ]);
    } catch (e) {
      setLines((L) => [
        ...L,
        {
          role: "bot",
          text: e instanceof Error ? e.message : "Something went wrong",
        },
      ]);
    }
  }

  return (
    <div className="space-y-6">
      {/* Unlimited coins */}
      <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <Coins className="h-5 w-5 text-primary" />
          <h2 className="text-sm font-semibold">Unlimited X coins</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Admin only. Turn ON to test shop purchases. Turn OFF to restore your
          previous balance. Normal users never see this.
        </p>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 px-3 py-2">
          <Label htmlFor="unlimited-coins" className="text-sm">
            {coinState?.enabled ? "Unlimited ON" : "Unlimited OFF"}
          </Label>
          <Switch
            id="unlimited-coins"
            checked={Boolean(coinState?.enabled)}
            disabled={busy}
            onCheckedChange={(v) => void toggleCoins(v)}
          />
        </div>
      </section>

      {/* Admin bot */}
      <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <h2 className="text-sm font-semibold">Admin bot</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Only you (admin). Commands for coins and shop. Does not access your
          phone files — only app admin tools you allow.
        </p>
        <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl bg-muted/40 p-3 text-sm">
          {lines.map((line, i) => (
            <div
              key={i}
              className={
                line.role === "user"
                  ? "text-right text-primary"
                  : "whitespace-pre-wrap text-muted-foreground"
              }
            >
              {line.role === "user" ? `You: ${line.text}` : line.text}
            </div>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void runBot(input);
          }}
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="help · coins on · shop list"
          />
          <Button type="submit" size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </section>
    </div>
  );
}
