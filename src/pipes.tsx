/**
 * <AuthioPipesWidget /> — drop-in provider connection management surface
 * backed by `authio_pipes /v1/pipes/*`.
 *
 * Renders a list of connectable providers (Google, Slack, GitHub,
 * Salesforce, HubSpot) and the current user's connected accounts.
 * Users can connect new providers and revoke existing connections.
 *
 * Authentication contract: the widget receives a short-lived
 * `kind: "widget"` JWT minted by the customer's BFF via
 * `POST /v1/widget-tokens` with scope `["pipes.read", "pipes.write"]`.
 * Origin enforcement is server-side (same Q3 decision as other widgets).
 *
 * The widget NEVER receives or displays access tokens — those are
 * returned only to the customer's backend via the management API.
 */

import {
  type CSSProperties,
  type ReactElement,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createRoot, type Root } from "react-dom/client";
import { WidgetClient } from "./client";
import { WidgetError } from "./errors";
import {
  humanizeError,
  makeTranslator,
  resolveWidgetLocale,
  type Translator,
} from "./i18n";
import {
  common,
  error as errorCatalog,
  pipes as catalog,
} from "./i18n/messages.gen";
import { ensureStylesInjected } from "./styles";
import type {
  PipesConnection,
  PipesProvider,
  WidgetClientOptions,
} from "./types";

// =====================================================================
// Props and event types
// =====================================================================

export interface AuthioPipesWidgetProps extends WidgetClientOptions {
  onConnectionChange?: (event: PipesConnectionEvent) => void;
  style?: CSSProperties;
  className?: string;
}

export type PipesConnectionEvent =
  | { type: "loaded"; connections: PipesConnection[]; providers: PipesProvider[] }
  | { type: "connected"; connection: PipesConnection }
  | { type: "revoked"; connectionId: string; providerId: string }
  | { type: "error"; error: WidgetError };

export interface MountedPipesWidget {
  unmount: () => void;
  update: (props: Partial<AuthioPipesWidgetProps>) => void;
}

// =====================================================================
// React component
// =====================================================================

export function AuthioPipesWidget(
  props: AuthioPipesWidgetProps,
): ReactElement {
  const { onConnectionChange, style, className, ...clientOpts } = props;

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

  const [providers, setProviders] = useState<PipesProvider[]>([]);
  const [connections, setConnections] = useState<PipesConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<WidgetError | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const theme = clientOpts.theme ?? "light";
  const locale = useMemo(
    () => resolveWidgetLocale(clientOpts.locale),
    [clientOpts.locale],
  );
  const t = useMemo(() => makeTranslator(catalog, locale, common), [locale]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pResult, cResult] = await Promise.all([
        client.fetch<{ providers: PipesProvider[] }>("/widget/pipes/providers"),
        client.fetch<{ connections: PipesConnection[] }>("/widget/pipes/connections"),
      ]);
      setProviders(pResult.providers ?? []);
      setConnections(cResult.connections ?? []);
      onConnectionChange?.({
        type: "loaded",
        providers: pResult.providers ?? [],
        connections: cResult.connections ?? [],
      });
    } catch (err) {
      const we = err instanceof WidgetError ? err : new WidgetError("load_failed", 500, String(err));
      setError(we);
      onConnectionChange?.({ type: "error", error: we });
    } finally {
      setLoading(false);
    }
  }, [client, onConnectionChange]);

  useEffect(() => {
    load();
  }, [load]);

  const handleConnect = useCallback(
    async (providerId: string) => {
      try {
        const result = await client.fetch<{ authorization_url: string }>(
          `/widget/pipes/connections/${providerId}/authorize`,
          { method: "POST" },
        );
        window.location.href = result.authorization_url;
      } catch (err) {
        const we = err instanceof WidgetError ? err : new WidgetError("connect_failed", 500, String(err));
        onConnectionChange?.({ type: "error", error: we });
      }
    },
    [client, onConnectionChange],
  );

  const handleRevoke = useCallback(
    async (connection: PipesConnection) => {
      setRevoking(connection.id);
      try {
        await client.fetch(`/widget/pipes/connections/${connection.id}`, { method: "DELETE" });
        setConnections((prev) => prev.filter((c) => c.id !== connection.id));
        onConnectionChange?.({ type: "revoked", connectionId: connection.id, providerId: connection.provider_id });
      } catch (err) {
        const we = err instanceof WidgetError ? err : new WidgetError("revoke_failed", 500, String(err));
        onConnectionChange?.({ type: "error", error: we });
      } finally {
        setRevoking(null);
      }
    },
    [client, onConnectionChange],
  );

  const connectedIds = useMemo(
    () => new Set(connections.map((c) => c.provider_id)),
    [connections],
  );

  return (
    <div
      className={className}
      style={{
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        fontSize: 14,
        color: theme === "dark" ? "#f9fafb" : "#111827",
        backgroundColor: theme === "dark" ? "#1f2937" : "#ffffff",
        borderRadius: 8,
        border: `1px solid ${theme === "dark" ? "#374151" : "#e5e7eb"}`,
        overflow: "hidden",
        ...style,
      }}
    >
      <div style={{ padding: "16px 20px", borderBottom: `1px solid ${theme === "dark" ? "#374151" : "#e5e7eb"}` }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{t("title")}</h3>
        <p style={{ margin: "4px 0 0", fontSize: 12, color: theme === "dark" ? "#9ca3af" : "#6b7280" }}>
          {t("subtitle")}
        </p>
      </div>

      {loading ? (
        <WidgetSkeleton theme={theme} />
      ) : error ? (
        <WidgetErrorState t={t} locale={locale} error={error} onRetry={load} theme={theme} />
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {providers.map((prov) => {
            const conn = connections.find((c) => c.provider_id === prov.id);
            const isRevokingThis = revoking === conn?.id;
            return (
              <li
                key={prov.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "12px 20px",
                  borderBottom: `1px solid ${theme === "dark" ? "#374151" : "#f3f4f6"}`,
                  gap: 12,
                }}
              >
                <img
                  src={prov.icon_url}
                  alt={prov.display_name}
                  width={28}
                  height={28}
                  style={{ borderRadius: 4, flexShrink: 0 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: 13 }}>{prov.display_name}</div>
                  {conn ? (
                    <div style={{ fontSize: 11, color: theme === "dark" ? "#6ee7b7" : "#059669", marginTop: 1 }}>
                      {conn.external_account_email
                        ? t("connectedWith", { email: conn.external_account_email })
                        : t("connected")}
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: theme === "dark" ? "#9ca3af" : "#6b7280", marginTop: 1 }}>
                      {prov.description}
                    </div>
                  )}
                </div>
                {conn ? (
                  <button
                    onClick={() => handleRevoke(conn)}
                    disabled={isRevokingThis}
                    style={btnStyle(theme, "danger", isRevokingThis)}
                    aria-label={t("disconnectAria", { provider: prov.display_name })}
                  >
                    {isRevokingThis ? t("disconnecting") : t("disconnect")}
                  </button>
                ) : (
                  <button
                    onClick={() => handleConnect(prov.id)}
                    style={btnStyle(theme, "primary", false)}
                    aria-label={t("connectAria", { provider: prov.display_name })}
                  >
                    {t("connect")}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// =====================================================================
// Internal sub-components
// =====================================================================

function WidgetSkeleton({ theme }: { theme: "light" | "dark" }): ReactElement {
  const bg = theme === "dark" ? "#374151" : "#f3f4f6";
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <li key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px" }}>
          <div style={{ width: 28, height: 28, borderRadius: 4, backgroundColor: bg }} />
          <div style={{ flex: 1 }}>
            <div style={{ height: 12, width: "30%", borderRadius: 4, backgroundColor: bg, marginBottom: 4 }} />
            <div style={{ height: 10, width: "55%", borderRadius: 4, backgroundColor: bg }} />
          </div>
          <div style={{ height: 28, width: 72, borderRadius: 6, backgroundColor: bg }} />
        </li>
      ))}
    </ul>
  );
}

function WidgetErrorState({
  t,
  locale,
  error,
  onRetry,
  theme,
}: {
  t: Translator;
  locale: import("./i18n").Locale;
  error: WidgetError;
  onRetry: () => void;
  theme: "light" | "dark";
}): ReactElement {
  const message =
    humanizeError(errorCatalog, locale, error.code, error.message) ||
    t("errorFallback");
  return (
    <div style={{ padding: 20, textAlign: "center" }}>
      <p style={{ color: theme === "dark" ? "#f87171" : "#dc2626", fontSize: 13, margin: "0 0 12px" }}>
        {message}
      </p>
      <button onClick={onRetry} style={btnStyle(theme, "primary", false)}>
        {t("retry")}
      </button>
    </div>
  );
}

function btnStyle(
  theme: "light" | "dark",
  variant: "primary" | "danger",
  disabled: boolean,
): CSSProperties {
  const base: CSSProperties = {
    border: "none",
    borderRadius: 6,
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 12,
    fontWeight: 500,
    padding: "5px 12px",
    opacity: disabled ? 0.6 : 1,
    transition: "opacity 0.1s",
    whiteSpace: "nowrap",
  };
  if (variant === "primary") {
    return { ...base, backgroundColor: "#4f46e5", color: "#fff" };
  }
  return {
    ...base,
    backgroundColor: "transparent",
    color: theme === "dark" ? "#f87171" : "#dc2626",
    border: `1px solid ${theme === "dark" ? "#ef4444" : "#fca5a5"}`,
  };
}

// =====================================================================
// Imperative mount API (vanilla JS / non-React hosts)
// =====================================================================

/**
 * Mount the Pipes widget without React as a peer dependency in the host.
 *
 * ```ts
 * const widget = mountPipesWidget(document.getElementById('pipes-root'), {
 *   token: widgetToken,
 *   organizationId: orgId,
 * });
 * // Later:
 * widget.unmount();
 * ```
 */
export function mountPipesWidget(
  container: Element,
  props: AuthioPipesWidgetProps,
): MountedPipesWidget {
  const root: Root = createRoot(container);
  const propsRef = { current: props };

  function render() {
    root.render(<AuthioPipesWidget {...propsRef.current} />);
  }

  render();

  return {
    unmount() {
      root.unmount();
    },
    update(partial) {
      propsRef.current = { ...propsRef.current, ...partial };
      render();
    },
  };
}
