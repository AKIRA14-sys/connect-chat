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
  {
    to: "/chats",
    label: "Chats",
    icon: MessageCircle,
  },
  {
    to: "/xups",
    label: "XUPs",
    icon: Sparkles,
  },
  {
    to: "/contacts",
    label: "Contacts",
    icon: Users,
  },
  {
    to: "/shop",
    label: "Shop",
    icon: ShoppingBag,
  },
  {
    to: "/settings",
    label: "You",
    icon: Settings,
  },
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
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col app-gradient">
      <div className="flex flex-1 flex-col pb-20">{children}</div>

      {!hideNav && (
        <nav className="fixed bottom-0 left-1/2 z-30 w-full max-w-2xl -translate-x-1/2 border-t border-border bg-surface/95 backdrop-blur safe-bottom">
          <ul className="grid grid-cols-5">
            {tabs.map(({ to, label, icon: Icon }) => {
              const active = path.startsWith(to);

              return (
                <li key={to}>
                  <Link
                    to={to}
                    className={cn(
                      "relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-all duration-300",
                      active
                        ? "text-primary"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className={cn("h-5 w-5 transition-transform duration-300", active && "scale-110")} />
                    {label}
                    {active && (
                      <span className="absolute -bottom-1 h-1 w-1 rounded-full bg-primary" />
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
    <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border/40 bg-background/70 px-4 py-3 backdrop-blur-md safe-top transition-all duration-300">
      <div className="flex flex-col">
        <h1 className="text-xl font-bold tracking-tight text-foreground">{title}</h1>

        {subtitle && (
          <p className="text-xs font-medium text-muted-foreground/80">{subtitle}</p>
        )}
      </div>

      {action}
    </header>
  );
}
