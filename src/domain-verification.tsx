/**
 * <AuthioDomainVerificationWidget /> — DNS TXT domain verification for
 * an organization, backed by `auth-core /widget/domains*`.
 *
 * Scope: "domain_verification".
 * Challenge value matches the hosted SSO Setup Portal so IT admins
 * can use either path interchangeably.
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
import {
  humanizeError,
  makeTranslator,
  resolveWidgetLocale,
} from "./i18n";
import {
  common,
  domainVerification as catalog,
  error as errorCatalog,
} from "./i18n/messages.gen";
import { ensureStylesInjected } from "./styles";
import type {
  DomainChallengeRecord,
  OrgDomain,
  WidgetClientOptions,
} from "./types";

export interface AuthioDomainVerificationWidgetProps extends WidgetClientOptions {
  style?: CSSProperties;
  className?: string;
  onDomainUpdate?: (event: DomainVerificationEvent) => void;
}

export type DomainVerificationEvent =
  | { type: "loaded"; domains: OrgDomain[]; record: DomainChallengeRecord }
  | { type: "verified"; domain: OrgDomain }
  | { type: "pending"; domain: string; record: DomainChallengeRecord }
  | { type: "deleted"; domainId: string }
  | { type: "error"; error: WidgetError };

export function AuthioDomainVerificationWidget(
  props: AuthioDomainVerificationWidgetProps,
): ReactElement {
  const { style, className, onDomainUpdate, ...clientOpts } = props;

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

  const [domains, setDomains] = useState<OrgDomain[] | null>(null);
  const [record, setRecord] = useState<DomainChallengeRecord | null>(null);
  const [domainInput, setDomainInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<WidgetError | null>(null);
  const [pendingMsg, setPendingMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const emit = useCallback(
    (event: DomainVerificationEvent) => onDomainUpdate?.(event),
    [onDomainUpdate],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const out = await client.fetch<{
        data: OrgDomain[];
        record: DomainChallengeRecord;
      }>("/widget/domains");
      setDomains(out.data);
      setRecord(out.record);
      const first = out.data[0];
      if (first?.domain && !domainInput) setDomainInput(first.domain);
      emit({ type: "loaded", domains: out.data, record: out.record });
    } catch (err) {
      const e = asWidget(err);
      setError(e);
      emit({ type: "error", error: e });
    } finally {
      setLoading(false);
    }
    // domainInput intentionally omitted — only seed once from load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, emit]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleVerify = useCallback(async () => {
    setChecking(true);
    setError(null);
    setPendingMsg(null);
    try {
      const out = await client.fetch<{
        verified: boolean;
        domain: OrgDomain | string;
        record?: DomainChallengeRecord;
        message?: string;
      }>("/widget/domains/verify", {
        method: "POST",
        body: { domain: domainInput.trim() },
      });
      if (out.record) setRecord(out.record);
      if (out.verified && typeof out.domain === "object" && out.domain !== null) {
        const verifiedDomain = out.domain;
        setDomains((prev) => {
          const rest = (prev ?? []).filter((d) => d.id !== verifiedDomain.id);
          return [...rest, verifiedDomain];
        });
        emit({ type: "verified", domain: verifiedDomain });
      } else {
        const msg = out.message ?? t("pending");
        setPendingMsg(msg);
        emit({
          type: "pending",
          domain: typeof out.domain === "string" ? out.domain : domainInput,
          record: out.record ??
            record ?? {
              type: "TXT",
              host_prefix: "_authio-challenge",
              value: "",
            },
        });
      }
    } catch (err) {
      const e = asWidget(err);
      setError(e);
      emit({ type: "error", error: e });
    } finally {
      setChecking(false);
    }
  }, [client, domainInput, emit, record, t]);

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await client.fetch<void>(`/widget/domains/${id}`, {
          method: "DELETE",
          expect: "text",
        });
        setDomains((prev) => (prev ?? []).filter((d) => d.id !== id));
        emit({ type: "deleted", domainId: id });
      } catch (err) {
        const e = asWidget(err);
        setError(e);
        emit({ type: "error", error: e });
      }
    },
    [client, emit],
  );

  const recordHost = record
    ? `${record.host_prefix}.${domainInput.trim() || "yourdomain.com"}`
    : "";

  async function copyValue() {
    if (!record) return;
    try {
      await navigator.clipboard.writeText(record.value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  const theme = clientOpts.theme ?? "light";
  const cls = ["aw-root", className].filter(Boolean).join(" ");

  return (
    <div
      data-authio-widget
      data-theme={theme}
      className={cls}
      style={style}
    >
      <header>
        <div>
          <h2>{t("title")}</h2>
        </div>
      </header>
      <p className="aw-muted">{t("subtitle")}</p>

      {error && (
        <div className="aw-error" role="alert">
          {describeError(error)}
          <button type="button" className="aw-btn" onClick={() => void load()}>
            {t("retry")}
          </button>
        </div>
      )}

      {loading ? (
        <div className="aw-empty">
          <span className="aw-spinner" /> {t("loading")}
        </div>
      ) : (
        <div className="aw-grid">
          <div>
            <label htmlFor="aw-domain-input">{t("domainLabel")}</label>
            <input
              id="aw-domain-input"
              type="text"
              value={domainInput}
              onChange={(e) => setDomainInput(e.target.value)}
              placeholder={t("domainPlaceholder")}
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          <p className="aw-muted">{t("instructions")}</p>

          {record && (
            <div
              className="aw-grid"
              style={{
                border: "1px solid var(--aw-border)",
                borderRadius: 6,
                padding: 12,
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: 12,
              }}
            >
              <RecordRow label={t("record.type")} value={record.type} />
              <RecordRow label={t("record.host")} value={recordHost} />
              <div>
                <div className="aw-muted">{t("record.value")}</div>
                <div style={{ wordBreak: "break-all" }}>{record.value}</div>
                <button
                  type="button"
                  className="aw-btn"
                  style={{ marginTop: 8 }}
                  onClick={() => void copyValue()}
                >
                  {copied ? t("copied") : t("copy")}
                </button>
              </div>
            </div>
          )}

          {pendingMsg && (
            <div className="aw-pill" data-tone="warn" role="status">
              {pendingMsg}
            </div>
          )}

          <div className="aw-row">
            <button
              type="button"
              className="aw-btn"
              data-variant="primary"
              disabled={checking || !domainInput.trim()}
              onClick={() => void handleVerify()}
            >
              {checking ? t("checking") : t("checkNow")}
            </button>
          </div>

          {domains && domains.length > 0 ? (
            <table>
              <thead>
                <tr>
                  <th>{t("columns.domain")}</th>
                  <th>{t("columns.status")}</th>
                  <th aria-label="actions" />
                </tr>
              </thead>
              <tbody>
                {domains.map((d) => (
                  <tr key={d.id}>
                    <td style={{ fontFamily: "ui-monospace, monospace" }}>
                      {d.domain}
                    </td>
                    <td>
                      <span
                        className="aw-pill"
                        data-tone={d.verified ? "success" : "warn"}
                      >
                        {d.verified ? t("status.verified") : t("status.pending")}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="aw-btn"
                        data-variant="danger"
                        onClick={() => {
                          if (
                            typeof window !== "undefined" &&
                            window.confirm(t("deleteConfirm", { domain: d.domain }))
                          ) {
                            void handleDelete(d.id);
                          }
                        }}
                      >
                        {t("delete")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="aw-empty">{t("empty")}</div>
          )}
        </div>
      )}
    </div>
  );
}

function RecordRow(props: { label: string; value: string }): ReactElement {
  return (
    <div>
      <div className="aw-muted">{props.label}</div>
      <div>{props.value}</div>
    </div>
  );
}

function asWidget(err: unknown): WidgetError {
  if (err instanceof WidgetError) return err;
  return new WidgetError(
    "client_error",
    0,
    err instanceof Error ? err.message : String(err),
  );
}

// =====================================================================
// Imperative mount
// =====================================================================

export interface MountedDomainVerificationWidget {
  update: (opts: AuthioDomainVerificationWidgetProps) => void;
  unmount: () => void;
}

export function mountDomainVerificationWidget(
  el: Element,
  opts: AuthioDomainVerificationWidgetProps,
): MountedDomainVerificationWidget {
  const root: Root = createRoot(el);
  let current = opts;
  const render = (next: AuthioDomainVerificationWidgetProps) => {
    current = next;
    root.render(<AuthioDomainVerificationWidget {...next} />);
  };
  render(opts);
  return {
    update: (next) => render({ ...current, ...next }),
    unmount: () => root.unmount(),
  };
}
