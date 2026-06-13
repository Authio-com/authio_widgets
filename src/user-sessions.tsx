/**
 * <AuthioUserSessionsWidget /> — active-session list for the current
 * user in the org context, backed by `auth-core /widget/sessions`.
 *
 * Scope: "sessions.read".
 * Requires widget JWT to carry `widget_user_id` (the current user's id).
 * Shows: device/browser, IP, location, last active.
 * Actions: revoke one session, revoke all other sessions.
 */

import {
  type CSSProperties,
  type ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createRoot, type Root } from "react-dom/client";
import { WidgetClient } from "./client";
import { WidgetError } from "./errors";
import { humanizeError, makeTranslator, resolveWidgetLocale } from "./i18n";
import {
  common,
  error as errorCatalog,
  userSessions as catalog,
} from "./i18n/messages.gen";
import { ensureStylesInjected } from "./styles";
import type { UserSession, WidgetClientOptions } from "./types";

// =====================================================================
// Public component props
// =====================================================================

export interface AuthioUserSessionsWidgetProps extends WidgetClientOptions {
  style?: CSSProperties;
  className?: string;
  onSessionRevoked?: (event: SessionEvent) => void;
}

export type SessionEvent =
  | { type: "loaded"; sessions: UserSession[] }
  | { type: "revoked"; sessionId: string }
  | { type: "revoked_all"; revokedCount: number }
  | { type: "error"; error: WidgetError };

// =====================================================================
// React component
// =====================================================================

export function AuthioUserSessionsWidget(
  props: AuthioUserSessionsWidgetProps,
): ReactElement {
  const { style, className, onSessionRevoked, ...clientOpts } = props;

  const locale = useMemo(
    () => resolveWidgetLocale(clientOpts.locale),
    [clientOpts.locale],
  );
  const t = useMemo(() => makeTranslator(catalog, locale, common), [locale]);
  const describeError = useCallback(
    (e: WidgetError) => humanizeError(errorCatalog, locale, e.code, e.message),
    [locale],
  );

  useEffect(() => {
    ensureStylesInjected();
  }, []);

  const client = useMemo(
    () =>
      new WidgetClient({
        token: clientOpts.token,
        organizationId: clientOpts.organizationId,
        apiUrl: clientOpts.apiUrl,
      }),
    [clientOpts.token, clientOpts.organizationId, clientOpts.apiUrl],
  );

  const [sessions, setSessions] = useState<UserSession[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<WidgetError | null>(null);

  const emit = useCallback(
    (event: SessionEvent) => onSessionRevoked?.(event),
    [onSessionRevoked],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const out = await client.fetch<{ data: UserSession[] }>("/widget/sessions");
      setSessions(out.data);
      emit({ type: "loaded", sessions: out.data });
    } catch (err) {
      const e = asWidget(err);
      setError(e);
      emit({ type: "error", error: e });
    } finally {
      setLoading(false);
    }
  }, [client, emit]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRevokeOne = useCallback(
    async (sessionId: string) => {
      setError(null);
      try {
        await client.fetch<void>(`/widget/sessions/${sessionId}`, { method: "DELETE" });
        setSessions((prev) => prev?.filter((s) => s.id !== sessionId) ?? null);
        emit({ type: "revoked", sessionId });
      } catch (err) {
        const e = asWidget(err);
        setError(e);
        emit({ type: "error", error: e });
      }
    },
    [client, emit],
  );

  const handleRevokeAll = useCallback(async () => {
    setError(null);
    try {
      const out = await client.fetch<{ revoked: number }>("/widget/sessions", {
        method: "DELETE",
      });
      setSessions([]);
      emit({ type: "revoked_all", revokedCount: out.revoked });
    } catch (err) {
      const e = asWidget(err);
      setError(e);
      emit({ type: "error", error: e });
    }
  }, [client, emit]);

  return (
    <div
      data-authio-widget="user-sessions"
      data-theme={clientOpts.theme ?? "light"}
      className={className}
      style={style}
    >
      <header>
        <div>
          <h2>{t("title")}</h2>
          <p className="aw-muted">{t("subtitle")}</p>
        </div>
        {sessions && sessions.length > 0 && (
          <button
            type="button"
            className="aw-btn"
            data-variant="danger"
            onClick={() => {
              if (
                typeof window !== "undefined" &&
                window.confirm(t("revokeAllConfirm"))
              ) {
                void handleRevokeAll();
              }
            }}
          >
            {t("revokeAll")}
          </button>
        )}
      </header>

      {error && (
        <div className="aw-error" role="alert">
          {describeError(error)}{" "}
          <span className="aw-muted">({error.code})</span>
        </div>
      )}

      {loading ? (
        <div className="aw-empty">
          <span className="aw-spinner" /> {t("loading")}
        </div>
      ) : sessions === null || sessions.length === 0 ? (
        <div className="aw-empty">{t("empty")}</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>{t("columns.device")}</th>
              <th>{t("columns.ip")}</th>
              <th>{t("columns.location")}</th>
              <th>{t("columns.lastActive")}</th>
              <th aria-label="actions" />
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id}>
                <td>
                  {s.browser ? (
                    <span style={{ fontSize: 13 }}>{s.browser}</span>
                  ) : (
                    <span className="aw-muted">{t("unknownBrowser")}</span>
                  )}
                  {s.device && (
                    <div className="aw-muted" style={{ fontSize: 11 }}>
                      {s.device}
                    </div>
                  )}
                </td>
                <td style={{ fontSize: 12, fontFamily: "ui-monospace, monospace" }}>
                  {s.ip ?? t("dash")}
                </td>
                <td style={{ fontSize: 12 }}>{s.location ?? t("dash")}</td>
                <td style={{ fontSize: 12 }}>
                  {new Date(s.last_active_at).toLocaleString()}
                </td>
                <td>
                  <button
                    type="button"
                    className="aw-btn"
                    data-variant="danger"
                    onClick={() => {
                      if (
                        typeof window !== "undefined" &&
                        window.confirm(t("revokeConfirm"))
                      ) {
                        void handleRevokeOne(s.id);
                      }
                    }}
                  >
                    {t("revoke")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// =====================================================================
// Imperative mount API
// =====================================================================

export interface MountedUserSessionsWidget {
  update(opts: AuthioUserSessionsWidgetProps): void;
  unmount(): void;
}

export function mountUserSessionsWidget(
  el: Element,
  opts: AuthioUserSessionsWidgetProps,
): MountedUserSessionsWidget {
  let root: Root | null = createRoot(el);
  let current = opts;
  root.render(<AuthioUserSessionsWidget {...current} />);
  return {
    update(next) {
      current = next;
      if (root) root.render(<AuthioUserSessionsWidget {...current} />);
    },
    unmount() {
      if (root) {
        root.unmount();
        root = null;
      }
    },
  };
}

function asWidget(err: unknown): WidgetError {
  if (err instanceof WidgetError) return err;
  return new WidgetError(
    "client_error",
    0,
    err instanceof Error ? err.message : String(err),
  );
}
