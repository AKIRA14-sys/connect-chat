import { Link, useRouterState } from "@tanstack/react-router";
import { MessageCircle, Phone, Settings, Users } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/chats", label: "Chats", icon: MessageCircle },
  { to: "/friends", label: "Friends", icon: Users },
  { to: "/calls", label: "Calls", icon: Phone },
  { to: "/settings", label: "You", icon: Settings },
];

export function AppShell({ children, hideNav }: { children: ReactNode; hideNav?: boolean }) {
  const path = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col app-gradient">
      <div className="flex flex-1 flex-col pb-20">{children}</div>
      {!hideNav && (
        <nav className="fixed bottom-0 left-1/2 z-30 w-full max-w-2xl -translate-x-1/2 border-t border-border bg-surface/95 backdrop-blur safe-bottom">
          <ul className="grid grid-cols-4">
            {tabs.map(({ to, label, icon: Icon }) => {
              const active = path.startsWith(to);
              return (
                <li key={to}>
                  <Link
                    to={to}
                    className={cn(
                      "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
                      active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {label}
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
    <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur safe-top">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}
