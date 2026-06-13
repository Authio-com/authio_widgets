/**
 * <AuthioAPIKeysWidget /> — org API key management surface backed by
 * `auth-core /widget/api-keys`.
 *
 * Scope: "api_keys.manage".
 * Shows: name, prefix, scopes, created_at, last_used_at, expiry.
 * Actions: create key (shows raw key once), revoke key.
 */

import {
  type CSSProperties,
  type ReactElement,
  type ReactNode,
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
  type Translator,
} from "./i18n";
import {
  apiKeys as catalog,
  common,
  error as errorCatalog,
} from "./i18n/messages.gen";
import { ensureStylesInjected } from "./styles";
import type { ApiKey, WidgetClientOptions } from "./types";

// =====================================================================
// Public component props
// =====================================================================

export interface AuthioAPIKeysWidgetProps extends WidgetClientOptions {
  style?: CSSProperties;
  className?: string;
  onKeyCreated?: (event: ApiKeyEvent) => void;
}

export type ApiKeyEvent =
  | { type: "loaded"; keys: ApiKey[] }
  | { type: "created"; key: ApiKey; rawKey: string }
  | { type: "revoked"; keyId: string }
  | { type: "error"; error: WidgetError };

// =====================================================================
// React component
// =====================================================================

export function AuthioAPIKeysWidget(
  props: AuthioAPIKeysWidgetProps,
): ReactElement {
  const { style, className, onKeyCreated, ...clientOpts } = props;

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

  const [keys, setKeys] = useState<ApiKey[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<WidgetError | null>(null);
  const [creating, setCreating] = useState(false);
  const [newKeyReveal, setNewKeyReveal] = useState<{
    key: ApiKey;
    rawKey: string;
  } | null>(null);

  const emit = useCallback(
    (event: ApiKeyEvent) => onKeyCreated?.(event),
    [onKeyCreated],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const out = await client.fetch<{ data: ApiKey[] }>("/widget/api-keys");
      setKeys(out.data);
      emit({ type: "loaded", keys: out.data });
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

  const handleCreate = useCallback(
    async (body: { name: string; scopes: string[]; expiry_days?: number }) => {
      setError(null);
      try {
        const out = await client.fetch<{ api_key: ApiKey; key: string }>(
          "/widget/api-keys",
          { method: "POST", body },
        );
        setKeys((prev) => (prev ? [out.api_key, ...prev] : [out.api_key]));
        setCreating(false);
        setNewKeyReveal({ key: out.api_key, rawKey: out.key });
        emit({ type: "created", key: out.api_key, rawKey: out.key });
      } catch (err) {
        const e = asWidget(err);
        setError(e);
        emit({ type: "error", error: e });
      }
    },
    [client, emit],
  );

  const handleRevoke = useCallback(
    async (keyId: string) => {
      setError(null);
      try {
        await client.fetch<void>(`/widget/api-keys/${keyId}`, { method: "DELETE" });
        setKeys((prev) => prev?.filter((k) => k.id !== keyId) ?? null);
        emit({ type: "revoked", keyId });
      } catch (err) {
        const e = asWidget(err);
        setError(e);
        emit({ type: "error", error: e });
      }
    },
    [client, emit],
  );

  return (
    <div
      data-authio-widget="api-keys"
      data-theme={clientOpts.theme ?? "light"}
      className={className}
      style={style}
    >
      <header>
        <div>
          <h2>{t("title")}</h2>
          <p className="aw-muted">{t("subtitle")}</p>
        </div>
        {!creating && (
          <button
            type="button"
            className="aw-btn"
            data-variant="primary"
            onClick={() => setCreating(true)}
          >
            {t("create")}
          </button>
        )}
      </header>

      {error && (
        <div className="aw-error" role="alert">
          {describeError(error)}{" "}
          <span className="aw-muted">({error.code})</span>
        </div>
      )}

      {newKeyReveal && (
        <NewKeyReveal
          t={t}
          apiKey={newKeyReveal.key}
          rawKey={newKeyReveal.rawKey}
          onClose={() => setNewKeyReveal(null)}
        />
      )}

      {creating && (
        <CreateKeyForm t={t} onCancel={() => setCreating(false)} onSubmit={handleCreate} />
      )}

      {loading ? (
        <div className="aw-empty">
          <span className="aw-spinner" /> {t("loading")}
        </div>
      ) : keys === null || keys.length === 0 ? (
        <div className="aw-empty">{t("empty")}</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>{t("columns.name")}</th>
              <th>{t("columns.prefix")}</th>
              <th>{t("columns.created")}</th>
              <th>{t("columns.lastUsed")}</th>
              <th aria-label="actions" />
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k.id}>
                <td>
                  {k.name}
                  {k.scopes.length > 0 && (
                    <div className="aw-muted" style={{ fontSize: 11 }}>
                      {k.scopes.join(", ")}
                    </div>
                  )}
                </td>
                <td style={{ fontFamily: "ui-monospace, monospace", fontSize: 12 }}>
                  {k.prefix}…
                </td>
                <td style={{ fontSize: 12 }}>
                  {new Date(k.created_at).toLocaleDateString()}
                </td>
                <td style={{ fontSize: 12 }}>
                  {k.last_used_at ? (
                    new Date(k.last_used_at).toLocaleDateString()
                  ) : (
                    <span className="aw-muted">{t("never")}</span>
                  )}
                </td>
                <td>
                  <button
                    type="button"
                    className="aw-btn"
                    data-variant="danger"
                    onClick={() => {
                      if (
                        typeof window !== "undefined" &&
                        window.confirm(t("revokeConfirm", { name: k.name }))
                      ) {
                        void handleRevoke(k.id);
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
// Sub-components
// =====================================================================

function CreateKeyForm(props: {
  t: Translator;
  onCancel: () => void;
  onSubmit: (body: {
    name: string;
    scopes: string[];
    expiry_days?: number;
  }) => void | Promise<void>;
}): ReactElement {
  const { t } = props;
  const [name, setName] = useState("");
  const [scopeInput, setScopeInput] = useState("");
  const [expiryDays, setExpiryDays] = useState("");
  const [submitting, setSubmitting] = useState(false);

  return (
    <form
      className="aw-grid"
      onSubmit={async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
          const scopes = scopeInput
            .split(/[\s,]+/)
            .map((s) => s.trim())
            .filter(Boolean);
          await props.onSubmit({
            name,
            scopes,
            expiry_days: expiryDays ? parseInt(expiryDays, 10) : undefined,
          });
        } finally {
          setSubmitting(false);
        }
      }}
    >
      <Field label={t("form.name")}>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("form.namePlaceholder")}
          required
        />
      </Field>
      <Field label={t("form.scopes")}>
        <input
          type="text"
          value={scopeInput}
          onChange={(e) => setScopeInput(e.target.value)}
          placeholder={t("form.scopesPlaceholder")}
        />
      </Field>
      <Field label={t("form.expiry")}>
        <input
          type="number"
          value={expiryDays}
          onChange={(e) => setExpiryDays(e.target.value)}
          min={1}
          max={365}
          placeholder={t("form.expiryPlaceholder")}
        />
      </Field>
      <div className="aw-row" style={{ justifyContent: "flex-end" }}>
        <button
          type="button"
          className="aw-btn"
          onClick={props.onCancel}
          disabled={submitting}
        >
          {t("cancel")}
        </button>
        <button
          type="submit"
          className="aw-btn"
          data-variant="primary"
          disabled={submitting}
        >
          {submitting ? t("form.creating") : t("form.create")}
        </button>
      </div>
    </form>
  );
}

function NewKeyReveal(props: {
  t: Translator;
  apiKey: ApiKey;
  rawKey: string;
  onClose: () => void;
}): ReactElement {
  const { t } = props;
  const [copied, setCopied] = useState(false);
  return (
    <div className="aw-grid" style={{ background: "rgba(22,163,74,0.06)", borderRadius: 8, padding: 16 }}>
      <div>
        <span className="aw-pill" data-tone="success">{t("reveal.badge")}</span>
        <p className="aw-muted" style={{ marginTop: 8 }}>
          {t("reveal.warning")}
        </p>
      </div>
      <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, wordBreak: "break-all" }}>
        {props.rawKey}
      </div>
      <div className="aw-row" style={{ justifyContent: "flex-end" }}>
        <button
          type="button"
          className="aw-btn"
          onClick={() => {
            if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
              void navigator.clipboard.writeText(props.rawKey).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              });
            }
          }}
        >
          {copied ? t("copied") : t("copy")}
        </button>
        <button type="button" className="aw-btn" data-variant="primary" onClick={props.onClose}>
          {t("reveal.saved")}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }): ReactElement {
  return (
    <div>
      <label>{label}</label>
      {children}
    </div>
  );
}

// =====================================================================
// Imperative mount API
// =====================================================================

export interface MountedAPIKeysWidget {
  update(opts: AuthioAPIKeysWidgetProps): void;
  unmount(): void;
}

export function mountAPIKeysWidget(
  el: Element,
  opts: AuthioAPIKeysWidgetProps,
): MountedAPIKeysWidget {
  let root: Root | null = createRoot(el);
  let current = opts;
  root.render(<AuthioAPIKeysWidget {...current} />);
  return {
    update(next) {
      current = next;
      if (root) root.render(<AuthioAPIKeysWidget {...current} />);
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
