import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider } from "@/hooks/useAuth";
import { RealtimeProvider } from "@/components/RealtimeProvider";
import { Toaster } from "@/components/ui/sonner";
import { ConnectionBanner } from "@/components/ConnectionBanner";
import { AppSplash } from "@/components/AppSplash";
import { initNativePush } from "@/lib/nativePush";
import { AppLockGate } from "@/components/AppLockGate";


function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "XUPPIN — Real-time messaging" },
      {
        name: "description",
        content:
          "XUPPIN is a fast, installable messaging app with private chats, groups, voice notes and calls.",
      },
      { name: "theme-color", content: "#0b1020" },
      { property: "og:title", content: "XUPPIN — Real-time messaging" },
      {
        property: "og:description",
        content: "Private chats, groups, voice notes and calls in one installable app.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "XUPPIN" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap",
      },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/icons/icon-192.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  // Persist the query cache so previously loaded chats render instantly and offline.
  useEffect(() => {
    let dispose: (() => void) | undefined;
    void (async () => {
      const [{ persistQueryClient }, { createSyncStoragePersister }] = await Promise.all([
        import("@tanstack/react-query-persist-client"),
        import("@tanstack/query-sync-storage-persister"),
      ]);
      const [unsubscribe] = persistQueryClient({
        queryClient,
        persister: createSyncStoragePersister({ storage: window.localStorage, key: "whatsxup.cache.v1" }),
        maxAge: 24 * 60 * 60 * 1000,
      });
      dispose = unsubscribe;

    })();
    return () => dispose?.();
  }, [queryClient]);

  // Service worker (production, non-preview only) + notification tap routing.
  useEffect(() => {
    void import("@/lib/pwa").then(({ registerServiceWorker }) => void registerServiceWorker());
    if (!("serviceWorker" in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; to?: string } | undefined;
      if (data?.type === "whatsxup-navigate" && data.to) void router.navigate({ to: data.to });
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [router]);

  useEffect(() => {
    void initNativePush();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AppSplash />
      <AuthProvider>
        <RealtimeProvider>
          <ConnectionBanner />
          {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
          <AppLockGate>
            <Outlet />
          </AppLockGate>
          <Toaster position="top-center" />
        </RealtimeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
