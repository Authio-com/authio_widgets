/**
 * <AuthioAuditLogWidget /> — paginated audit-event list for the
 * authenticated org, backed by `auth-core /widget/audit-events`.
 *
 * Scope: "audit_log.read".
 * Filters: date range, actor, event type.
 * Row click → expands metadata JSON.
 * Export CSV button → calls /widget/audit-events/export.
 */

import {
  type CSSProperties,
  type ReactElement,
  Fragment,
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
  auditLog as catalog,
  common,
  error as errorCatalog,
} from "./i18n/messages.gen";
import { ensureStylesInjected } from "./styles";
import type { AuditEvent, WidgetClientOptions } from "./types";

// =====================================================================
// Public component props
// =====================================================================

export interface AuthioAuditLogWidgetProps extends WidgetClientOptions {
  /** Page size. Default 50, max 200. */
  pageSize?: number;
  style?: CSSProperties;
  className?: string;
}

// =====================================================================
// React component
// =====================================================================

export function AuthioAuditLogWidget(
  props: AuthioAuditLogWidgetProps,
): ReactElement {
  const { style, className, pageSize = 50, ...clientOpts } = props;

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

  const [events, setEvents] = useState<AuditEvent[] | null>(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<WidgetError | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Filters
  const [actor, setActor] = useState("");
  const [eventType, setEventType] = useState("");
  const [after, setAfter] = useState("");
  const [before, setBefore] = useState("");

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams();
    params.set("limit", String(Math.min(pageSize, 200)));
    params.set("offset", String(offset));
    if (actor) params.set("actor", actor);
    if (eventType) params.set("event_type", eventType);
    if (after) params.set("after", after);
    if (before) params.set("before", before);
    return params.toString();
  }, [pageSize, offset, actor, eventType, after, before]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const out = await client.fetch<{ data: AuditEvent[]; total: number }>(
        `/widget/audit-events?${buildQuery()}`,
      );
      setEvents(out.data);
      setTotal(out.total);
    } catch (err) {
      setError(asWidget(err));
    } finally {
      setLoading(false);
    }
  }, [client, buildQuery]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const csv = await client.fetch<Blob>(`/widget/audit-events?${buildQuery()}&limit=500`, {
        expect: "blob",
      });
      const url = URL.createObjectURL(csv);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-events-${props.organizationId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(asWidget(err));
    } finally {
      setExporting(false);
    }
  }, [client, buildQuery, props.organizationId]);

  const applyFilters = useCallback(() => {
    setOffset(0);
    void load();
  }, [load]);

  const effectivePageSize = Math.min(pageSize, 200);

  return (
    <div
      data-authio-widget="audit-log"
      data-theme={clientOpts.theme ?? "light"}
      className={className}
      style={style}
    >
      <header>
        <div>
          <h2>{t("title")}</h2>
          <p className="aw-muted">{t("subtitle")}</p>
        </div>
        <button
          type="button"
          className="aw-btn"
          onClick={() => void handleExport()}
          disabled={exporting}
        >
          {exporting ? t("exporting") : t("export")}
        </button>
      </header>

      {/* Filters */}
      <div className="aw-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
        <div>
          <label>{t("filters.actor")}</label>
          <input
            type="text"
            value={actor}
            onChange={(e) => setActor(e.target.value)}
            placeholder={t("filters.actorPlaceholder")}
          />
        </div>
        <div>
          <label>{t("filters.eventType")}</label>
          <input
            type="text"
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            placeholder={t("filters.eventTypePlaceholder")}
          />
        </div>
        <div>
          <label>{t("filters.after")}</label>
          <input
            type="datetime-local"
            value={after}
            onChange={(e) => setAfter(e.target.value)}
          />
        </div>
        <div>
          <label>{t("filters.before")}</label>
          <input
            type="datetime-local"
            value={before}
            onChange={(e) => setBefore(e.target.value)}
          />
        </div>
      </div>
      <div className="aw-row" style={{ justifyContent: "flex-end", marginBottom: 8 }}>
        <button
          type="button"
          className="aw-btn"
          data-variant="primary"
          onClick={applyFilters}
        >
          {t("filters.apply")}
        </button>
        <button
          type="button"
          className="aw-btn"
          onClick={() => {
            setActor("");
            setEventType("");
            setAfter("");
            setBefore("");
            setOffset(0);
          }}
        >
          {t("filters.clear")}
        </button>
      </div>

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
      ) : events === null || events.length === 0 ? (
        <div className="aw-empty">{t("empty")}</div>
      ) : (
        <>
          <table>
            <thead>
              <tr>
                <th>{t("columns.time")}</th>
                <th>{t("columns.action")}</th>
                <th>{t("columns.actor")}</th>
                <th>{t("columns.target")}</th>
                <th>{t("columns.ip")}</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <Fragment key={e.id}>
                  <tr
                    style={{ cursor: "pointer" }}
                    onClick={() => setExpanded(expanded === e.id ? null : e.id)}
                  >
                    <td>
                      <span style={{ fontSize: 12 }}>
                        {new Date(e.created_at).toLocaleString()}
                      </span>
                    </td>
                    <td>
                      <span className="aw-pill">{e.action}</span>
                    </td>
                    <td>
                      <span className="aw-muted" style={{ fontSize: 12 }}>
                        {e.actor_type}
                      </span>
                      {e.actor_id && (
                        <div style={{ fontSize: 11, fontFamily: "ui-monospace, monospace" }}>
                          {e.actor_id}
                        </div>
                      )}
                    </td>
                    <td>
                      {e.target_type && (
                        <span style={{ fontSize: 12 }}>
                          {e.target_type}
                          {e.target_id && (
                            <span className="aw-muted"> / {e.target_id.slice(0, 12)}…</span>
                          )}
                        </span>
                      )}
                    </td>
                    <td>
                      <span style={{ fontSize: 11, fontFamily: "ui-monospace, monospace" }}>
                        {e.ip ?? "—"}
                      </span>
                    </td>
                  </tr>
                  {expanded === e.id && (
                    <tr>
                      <td colSpan={5} style={{ background: "rgba(0,0,0,0.02)", padding: "8px 12px" }}>
                        <pre
                          style={{
                            margin: 0,
                            fontSize: 11,
                            fontFamily: "ui-monospace, monospace",
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-all",
                          }}
                        >
                          {JSON.stringify(e, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>

          <div
            className="aw-row"
            style={{ justifyContent: "space-between", marginTop: 12, fontSize: 13 }}
          >
            <span className="aw-muted">
              {t("range", {
                from: offset + 1,
                to: Math.min(offset + effectivePageSize, total),
                total,
              })}
            </span>
            <div className="aw-row">
              <button
                type="button"
                className="aw-btn"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - effectivePageSize))}
              >
                {t("previous")}
              </button>
              <button
                type="button"
                className="aw-btn"
                disabled={offset + effectivePageSize >= total}
                onClick={() => setOffset(offset + effectivePageSize)}
              >
                {t("next")}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// =====================================================================
// Imperative mount API
// =====================================================================

export interface MountedAuditLogWidget {
  update(opts: AuthioAuditLogWidgetProps): void;
  unmount(): void;
}

export function mountAuditLogWidget(
  el: Element,
  opts: AuthioAuditLogWidgetProps,
): MountedAuditLogWidget {
  let root: Root | null = createRoot(el);
  let current = opts;
  root.render(<AuthioAuditLogWidget {...current} />);
  return {
    update(next) {
      current = next;
      if (root) root.render(<AuthioAuditLogWidget {...current} />);
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
