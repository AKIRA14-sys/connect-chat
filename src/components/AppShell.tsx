import { Link, useRouterState } from "@tanstack/react-router";
import {
  MessageCircle,
  Settings,
  ShoppingBag,
  Sparkles,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/chats", label: "Chats", icon: MessageCircle },
  { to: "/xups", label: "XUPs", icon: Sparkles },
  { to: "/contacts", label: "Contacts", icon: Users },
  { to: "/shop", label: "Shop", icon: ShoppingBag },
  { to: "/settings", label: "You", icon: Settings },
];

export function AppShell({
  children,
  hideNav,
}: {
  children: ReactNode;
  hideNav?: boolean;
}) {
  const path = useRouterState({
    select: (s) => s.location.pathname,
  });

  return (
    <div className="xuppin-shell mx-auto flex min-h-screen w-full max-w-2xl flex-col">
      <div className="flex flex-1 flex-col pb-[4.5rem]">{children}</div>

      {!hideNav && (
        <nav
          className="fixed bottom-0 left-1/2 z-30 w-full max-w-2xl -translate-x-1/2 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1"
          aria-label="Main"
        >
          <ul className="grid grid-cols-5 rounded-[1.75rem] border border-white/10 bg-[#0a0e1a]/95 shadow-[0_-8px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl">
            {tabs.map(({ to, label, icon: Icon }) => {
              const active = path.startsWith(to);
              return (
                <li key={to}>
                  <Link
                    to={to}
                    className={cn(
                      "relative flex flex-col items-center gap-0.5 px-1 py-2.5 text-[10px] font-semibold tracking-wide transition-all duration-300",
                      active
                        ? "text-sky-400"
                        : "text-slate-500 hover:text-slate-300",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-2xl transition-all duration-300",
                        active && "bg-sky-500/15 shadow-[0_0_20px_rgba(56,189,248,0.25)]",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-[1.35rem] w-[1.35rem] transition-transform duration-300",
                          active && "scale-110",
                        )}
                      />
                    </span>
                    {label}
                    {active && (
                      <span className="absolute bottom-1 h-1 w-1 rounded-full bg-sky-400" />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-white/5 bg-[#070b16]/80 px-4 py-3 backdrop-blur-xl safe-top">
      <div className="min-w-0">
        <h1 className="truncate text-lg font-bold tracking-tight text-white">
          {title}
        </h1>
        {subtitle ? (
          <p className="truncate text-xs text-slate-400">{subtitle}</p>
        ) : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-1">{action}</div> : null}
    </header>
  );
}
