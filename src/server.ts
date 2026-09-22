import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (
    request: Request,
    env: unknown,
    ctx: unknown,
  ) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }

  return serverEntryPromise;
}

/**
 * TanStack Start server functions use an internal same-origin RPC endpoint.
 *
 * IMPORTANT:
 * Do not replace server-function errors with our HTML error page.
 *
 * The client expects a machine-readable response from server functions.
 * Converting that response into HTML causes errors such as:
 *
 *   push dbg: call failed (<!DOCTYPE html>...)
 *
 * Keeping the original response allows the client to see the real
 * server-function error.
 */
function isServerFunctionRequest(request: Request): boolean {
  const url = new URL(request.url);

  return (
    url.pathname.startsWith("/_serverFn/") ||
    url.pathname.startsWith("/_serverFn")
  );
}

/**
 * h3 can turn some server-side exceptions into:
 *
 * {"unhandled":true,"message":"HTTPError"}
 *
 * For normal document requests we can still render the friendly
 * OTAKUVERSE error page.
 *
 * For server-function requests, however, the original response must
 * be preserved.
 */
async function normalizeCatastrophicSsrResponse(
  request: Request,
  response: Response,
): Promise<Response> {
  if (response.status < 500) {
    return response;
  }

  /*
   * NEVER convert a server-function response into HTML.
   *
   * This is especially important for:
   * - notifyNewMessage()
   * - savePushSubscription()
   * - other createServerFn() calls
   */
  if (isServerFunctionRequest(request)) {
    console.error(
      consumeLastCapturedError() ??
        new Error(
          `Server function returned HTTP ${response.status}`,
        ),
    );

    return response;
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    return response;
  }

  const body = await response.clone().text();

  if (!isH3SwallowedErrorBody(body)) {
    return response;
  }

  console.error(
    consumeLastCapturedError() ??
      new Error(`h3 swallowed SSR error: ${body}`),
  );

  return new Response(renderErrorPage(), {
    status: 500,
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as {
      unhandled?: unknown;
      message?: unknown;
    };

    return (
      payload.unhandled === true &&
      payload.message === "HTTPError"
    );
  } catch {
    return false;
  }
}

export default {
  async fetch(
    request: Request,
    env: unknown,
    ctx: unknown,
  ) {
    try {
      const handler = await getServerEntry();

      const response = await handler.fetch(
        request,
        env,
        ctx,
      );

      return await normalizeCatastrophicSsrResponse(
        request,
        response,
      );
    } catch (error) {
      console.error(error);

      /*
       * Server functions must receive a machine-readable
       * response rather than our normal HTML error page.
       */
      if (isServerFunctionRequest(request)) {
        return new Response(
          JSON.stringify({
            error:
              error instanceof Error
                ? error.message
                : "Server function request failed",
          }),
          {
            status: 500,
            headers: {
              "content-type": "application/json",
            },
          },
        );
      }

      /*
       * Normal page/navigation errors still use the
       * OTAKUVERSE-friendly error page.
       */
      return new Response(renderErrorPage(), {
        status: 500,
        headers: {
          "content-type": "text/html; charset=utf-8",
        },
      });
    }
  },
};