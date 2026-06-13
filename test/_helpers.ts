import { vi } from "vitest";

export interface FetchMock {
  mock: ReturnType<typeof vi.fn>;
  /** Helper to register a sequential response for a given path. */
  on(
    path: string,
    handler: (init: RequestInit | undefined, url: string) => Response | Promise<Response>,
  ): void;
  install(): void;
  uninstall(): void;
}

export function makeFetchMock(): FetchMock {
  const handlers = new Map<
    string,
    (init: RequestInit | undefined, url: string) => Response | Promise<Response>
  >();
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    for (const [pattern, handler] of handlers) {
      if (url.endsWith(pattern) || url.includes(pattern)) {
        return handler(init, url);
      }
    }
    throw new Error(`unmocked fetch: ${url}`);
  });
  let prev: typeof globalThis.fetch | undefined;
  return {
    mock: fn,
    on(path, handler) {
      handlers.set(path, handler);
    },
    install() {
      prev = globalThis.fetch;
      globalThis.fetch = fn as unknown as typeof globalThis.fetch;
    },
    uninstall() {
      if (prev) {
        globalThis.fetch = prev;
        prev = undefined;
      }
      handlers.clear();
      fn.mockClear();
    },
  };
}

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export function textResponse(status: number, body: string): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "application/xml" },
  });
}

export function errorResponse(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ code, message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}
