/**
 * Error helpers for `@useauthio/widgets`.
 *
 * Every fetch failure surfaces as a `WidgetError` with a machine-readable
 * `code` so host apps can branch on errors without parsing free-text
 * `message` strings. The `code` set mirrors auth-core's `/widget/*`
 * response shape.
 */

export class WidgetError extends Error {
  constructor(
    /**
     * Stable error code. Examples:
     *   - "widget_origin_mismatch"
     *   - "widget_token_expired"
     *   - "widget_token_revoked"
     *   - "widget_scope_required"
     *   - "network_error"
     */
    public readonly code: string,
    public readonly status: number,
    message?: string,
    public readonly traceId?: string,
  ) {
    super(message ?? code);
    this.name = "WidgetError";
  }
}

export interface WidgetErrorBody {
  code?: string;
  message?: string;
  trace_id?: string;
}

export async function asWidgetError(res: Response): Promise<WidgetError> {
  let body: WidgetErrorBody = {};
  try {
    body = (await res.json()) as WidgetErrorBody;
  } catch {
    // Some 5xx paths return text/plain; ignore and synthesise.
  }
  return new WidgetError(
    body.code ?? `http_${res.status}`,
    res.status,
    body.message ?? res.statusText ?? `HTTP ${res.status}`,
    body.trace_id,
  );
}
