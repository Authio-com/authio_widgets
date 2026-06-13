/**
 * Tiny fetch wrapper for the `/widget/*` API surface on auth-core.
 *
 * - Sets `Authorization: Bearer <widget JWT>`.
 * - Sets `X-Authio-Organization` so server-side error messages can
 *   distinguish "wrong org" from "valid token but wrong scope".
 * - Surfaces a typed `WidgetError` on non-2xx responses.
 *
 * Origin enforcement is server-side: auth-core reads the request's
 * `Origin` header and 403s if it isn't in the JWT's `widget_origins[]`
 * claim. The browser sets the header automatically for cross-origin
 * `fetch`; we don't try to override it here.
 */

import { asWidgetError, WidgetError } from "./errors";
import type { WidgetClientOptions } from "./types";

const DEFAULT_API_URL = "https://auth-api.authio.com";

export interface WidgetFetchInit {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  /** When the response is XML / plain-text (e.g. SP metadata XML),
   * pass `"text"` to bypass JSON parsing. */
  expect?: "json" | "text" | "blob";
  signal?: AbortSignal;
}

export class WidgetClient {
  private readonly token: string;
  private readonly orgId: string;
  private readonly base: string;

  constructor(opts: WidgetClientOptions) {
    if (!opts.token) {
      throw new WidgetError(
        "missing_token",
        400,
        "WidgetClient requires a `kind: \"widget\"` JWT.",
      );
    }
    if (!opts.organizationId) {
      throw new WidgetError(
        "missing_organization_id",
        400,
        "WidgetClient requires an organizationId.",
      );
    }
    this.token = opts.token;
    this.orgId = opts.organizationId;
    this.base = (opts.apiUrl ?? DEFAULT_API_URL).replace(/\/$/, "");
  }

  async fetch<T>(path: string, init: WidgetFetchInit = {}): Promise<T> {
    const url = this.base + path;
    const headers: Record<string, string> = {
      authorization: `Bearer ${this.token}`,
      "x-authio-organization": this.orgId,
    };
    let body: BodyInit | undefined;
    if (init.body !== undefined) {
      headers["content-type"] = "application/json";
      body = JSON.stringify(init.body);
    }
    let res: Response;
    try {
      res = await fetch(url, {
        method: init.method ?? "GET",
        headers,
        body,
        credentials: "omit",
        signal: init.signal,
      });
    } catch (err) {
      throw new WidgetError(
        "network_error",
        0,
        err instanceof Error ? err.message : String(err),
      );
    }
    if (!res.ok) {
      throw await asWidgetError(res);
    }
    if (res.status === 204) return undefined as T;
    const expect = init.expect ?? "json";
    if (expect === "text") return (await res.text()) as T;
    if (expect === "blob") return (await res.blob()) as T;
    return (await res.json()) as T;
  }
}
