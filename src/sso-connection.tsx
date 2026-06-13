/**
 * <AuthioSSOConnectionWidget /> — drop-in SSO Connection management
 * surface backed by `auth-core /widget/sso-connections/*`.
 *
 * Mounts an iframe-safe React tree (no portals to `document.body`,
 * no global event listeners) so it composes cleanly inside any host
 * app. The iframe-friendly behaviour matters because some hosts
 * (e.g. customer dashboards already running a Shadow DOM micro-
 * frontend) embed the widget through a sandboxed `<iframe>` rather
 * than a same-origin React mount.
 *
 * Authentication contract: the widget receives a short-lived
 * `kind: "widget"` JWT minted by the customer's BFF via
 * `POST /v1/widget-tokens`. Origin enforcement happens server-side.
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
  ssoConnection as catalog,
} from "./i18n/messages.gen";
import { ensureStylesInjected } from "./styles";
import type {
  SSOConnection,
  SSOProtocol,
  SSOProvider,
  WidgetClientOptions,
} from "./types";

const PROVIDERS: { value: SSOProvider; label: string; protocols: SSOProtocol[] }[] = [
  { value: "okta", label: "Okta", protocols: ["saml", "oidc"] },
  { value: "entra", label: "Microsoft Entra ID", protocols: ["saml", "oidc"] },
  { value: "google_workspace", label: "Google Workspace", protocols: ["saml"] },
  { value: "ping", label: "Ping Identity", protocols: ["saml", "oidc"] },
  { value: "onelogin", label: "OneLogin", protocols: ["saml", "oidc"] },
  { value: "jumpcloud", label: "JumpCloud", protocols: ["saml"] },
  { value: "adfs", label: "ADFS", protocols: ["saml"] },
  { value: "auth0", label: "Auth0", protocols: ["saml", "oidc"] },
  { value: "keycloak", label: "Keycloak", protocols: ["saml", "oidc"] },
  { value: "rippling", label: "Rippling", protocols: ["saml"] },
  { value: "generic_saml", label: "Generic SAML", protocols: ["saml"] },
  { value: "generic_oidc", label: "Generic OIDC", protocols: ["oidc"] },
];

// =====================================================================
// Public component props
// =====================================================================

export interface AuthioSSOConnectionWidgetProps extends WidgetClientOptions {
  /** Fired whenever a connection is created, updated or deleted. */
  onConnectionUpdate?: (event: SSOConnectionEvent) => void;
  /** Optional inline style override on the outer card. */
  style?: CSSProperties;
  /** Optional className appended to the outer card so host apps can
   * theme via CSS modules / scoped class names. */
  className?: string;
}

export type SSOConnectionEvent =
  | { type: "loaded"; connections: SSOConnection[] }
  | { type: "created"; connection: SSOConnection }
  | { type: "updated"; connection: SSOConnection }
  | { type: "deleted"; connectionId: string }
  | { type: "tested"; connectionId: string; ok: boolean }
  | { type: "error"; error: WidgetError };

// =====================================================================
// React component
// =====================================================================

export function AuthioSSOConnectionWidget(
  props: AuthioSSOConnectionWidgetProps,
): ReactElement {
  const { onConnectionUpdate, style, className, ...clientOpts } = props;

  const locale = useMemo(
    () => resolveWidgetLocale(clientOpts.locale),
    [clientOpts.locale],
  );
  const t = useMemo(() => makeTranslator(catalog, locale, common), [locale]);
  const describeError = useCallback(
    (e: WidgetError) => humanizeError(errorCatalog, locale, e.code, e.message),
    [locale],
  );

  // Style injection runs once per document — outside the render path
  // so React's strict-mode double-invoke doesn't double-append the
  // <style> tag.
  useEffect(() => {
    ensureStylesInjected();
  }, []);

  // Memoised client — recreated only when token / org / apiUrl
  // change. The host can re-render the widget on every render of
  // its parent without thrashing the auth-core fetcher.
  const client = useMemo(
    () =>
      new WidgetClient({
        token: clientOpts.token,
        organizationId: clientOpts.organizationId,
        apiUrl: clientOpts.apiUrl,
      }),
    [clientOpts.token, clientOpts.organizationId, clientOpts.apiUrl],
  );

  const [connections, setConnections] = useState<SSOConnection[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<WidgetError | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<SSOConnection | null>(null);
  const [metadataXml, setMetadataXml] = useState<{
    id: string;
    xml: string;
  } | null>(null);

  // Track blob URLs we mint for the metadata-XML download so we can
  // revoke them on unmount / replacement (mirrors the @useauthio/react
  // `RedirectToSignIn` blob-URL cleanup pattern; large XMLs would
  // otherwise leak memory in long-lived host pages).
  const blobUrlsRef = useRef<string[]>([]);
  useEffect(
    () => () => {
      for (const url of blobUrlsRef.current) {
        URL.revokeObjectURL(url);
      }
      blobUrlsRef.current = [];
    },
    [],
  );

  const emit = useCallback(
    (event: SSOConnectionEvent) => onConnectionUpdate?.(event),
    [onConnectionUpdate],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const out = await client.fetch<{ data: SSOConnection[] }>(
        "/widget/sso-connections",
      );
      setConnections(out.data);
      emit({ type: "loaded", connections: out.data });
    } catch (err) {
      const e = asWidget(err);
      setError(e);
      emit({ type: "error", error: e });
    } finally {
      setLoading(false);
    }
  }, [client, emit]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleCreate = useCallback(
    async (input: {
      provider: SSOProvider;
      protocol: SSOProtocol;
      display_name?: string;
      metadata_xml?: string;
      oidc_discovery_url?: string;
      oidc_client_id?: string;
      oidc_client_secret?: string;
    }) => {
      try {
        const created = await client.fetch<SSOConnection>(
          "/widget/sso-connections",
          { method: "POST", body: input },
        );
        setConnections((prev) =>
          prev ? [created, ...prev.filter((c) => c.id !== created.id)] : [created],
        );
        setAdding(false);
        emit({ type: "created", connection: created });
      } catch (err) {
        const e = asWidget(err);
        setError(e);
        emit({ type: "error", error: e });
      }
    },
    [client, emit],
  );

  const handleDelete = useCallback(
    async (connectionId: string) => {
      try {
        await client.fetch<void>(`/widget/sso-connections/${connectionId}`, {
          method: "DELETE",
        });
        setConnections((prev) =>
          prev ? prev.filter((c) => c.id !== connectionId) : prev,
        );
        emit({ type: "deleted", connectionId });
      } catch (err) {
        const e = asWidget(err);
        setError(e);
        emit({ type: "error", error: e });
      }
    },
    [client, emit],
  );

  const handleTest = useCallback(
    async (connectionId: string) => {
      try {
        const r = await client.fetch<{ ok: boolean; message?: string }>(
          `/widget/sso-connections/${connectionId}/test`,
          { method: "POST" },
        );
        emit({ type: "tested", connectionId, ok: r.ok });
      } catch (err) {
        const e = asWidget(err);
        setError(e);
        emit({ type: "error", error: e });
      }
    },
    [client, emit],
  );

  const handleViewMetadata = useCallback(
    async (connectionId: string) => {
      try {
        const xml = await client.fetch<string>(
          `/widget/sso-connections/${connectionId}/metadata`,
          { expect: "text" },
        );
        // Mint a blob URL so the IT admin can download the XML in one
        // click. Revoked on next mint and on unmount.
        const blob = new Blob([xml], { type: "application/xml" });
        const url = URL.createObjectURL(blob);
        // Replace any prior blob URL for this widget instance.
        for (const old of blobUrlsRef.current) URL.revokeObjectURL(old);
        blobUrlsRef.current = [url];
        setMetadataXml({ id: connectionId, xml });
        return url;
      } catch (err) {
        const e = asWidget(err);
        setError(e);
        emit({ type: "error", error: e });
        return null;
      }
    },
    [client, emit],
  );

  return (
    <div
      data-authio-widget="sso-connection"
      data-theme={clientOpts.theme ?? "light"}
      className={className}
      style={style}
    >
      <header>
        <div>
          <h2>{t("title")}</h2>
          <p className="aw-muted">{t("subtitle")}</p>
        </div>
        {!adding && !editing && (
          <button
            type="button"
            className="aw-btn"
            data-variant="primary"
            onClick={() => {
              setAdding(true);
              setError(null);
            }}
          >
            {t("newConnection")}
          </button>
        )}
      </header>

      {error && (
        <div className="aw-error" role="alert">
          {describeError(error)}{" "}
          <span className="aw-muted">({error.code})</span>
        </div>
      )}

      {adding && (
        <CreateForm t={t} onCancel={() => setAdding(false)} onSubmit={handleCreate} />
      )}

      {!adding && (
        <SSOConnectionList
          t={t}
          loading={loading}
          connections={connections ?? []}
          onTest={handleTest}
          onDelete={handleDelete}
          onViewMetadata={handleViewMetadata}
          onEdit={setEditing}
        />
      )}

      {metadataXml && (
        <MetadataPanel
          t={t}
          xml={metadataXml.xml}
          blobUrl={blobUrlsRef.current[0] ?? null}
          onClose={() => setMetadataXml(null)}
        />
      )}

      {editing && (
        <EditForm
          t={t}
          connection={editing}
          onCancel={() => setEditing(null)}
          onSubmit={async (patch) => {
            try {
              const updated = await client.fetch<SSOConnection>(
                `/widget/sso-connections/${editing.id}`,
                { method: "PATCH", body: patch },
              );
              setConnections((prev) =>
                prev
                  ? prev.map((c) => (c.id === updated.id ? updated : c))
                  : [updated],
              );
              setEditing(null);
              emit({ type: "updated", connection: updated });
            } catch (err) {
              const e = asWidget(err);
              setError(e);
              emit({ type: "error", error: e });
            }
          }}
        />
      )}
    </div>
  );
}

// =====================================================================
// Subcomponents
// =====================================================================

function SSOConnectionList(props: {
  t: Translator;
  loading: boolean;
  connections: SSOConnection[];
  onTest: (id: string) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  onViewMetadata: (id: string) => void | Promise<unknown>;
  onEdit: (c: SSOConnection) => void;
}): ReactElement {
  const { t } = props;
  if (props.loading) {
    return (
      <div className="aw-empty">
        <span className="aw-spinner" /> {t("loading")}
      </div>
    );
  }
  if (props.connections.length === 0) {
    return (
      <div className="aw-empty">{t("empty", { action: t("newConnection") })}</div>
    );
  }
  return (
    <table>
      <thead>
        <tr>
          <th>{t("columns.provider")}</th>
          <th>{t("columns.protocol")}</th>
          <th>{t("columns.status")}</th>
          <th>{t("columns.configured")}</th>
          <th aria-label="actions" />
        </tr>
      </thead>
      <tbody>
        {props.connections.map((c) => (
          <tr key={c.id}>
            <td>
              {labelForProvider(c.provider)}
              {c.display_name ? (
                <div className="aw-muted" style={{ fontSize: 12 }}>
                  {c.display_name}
                </div>
              ) : null}
            </td>
            <td>{c.protocol.toUpperCase()}</td>
            <td>
              <span
                className="aw-pill"
                data-tone={
                  c.status === "active"
                    ? "success"
                    : c.status === "suspended"
                      ? "danger"
                      : undefined
                }
              >
                {t(`status.${c.status}`)}
              </span>
            </td>
            <td>
              {c.configured_at ? (
                new Date(c.configured_at).toLocaleDateString()
              ) : (
                <span className="aw-muted">{t("never")}</span>
              )}
            </td>
            <td>
              <div className="aw-row" style={{ justifyContent: "flex-end" }}>
                {c.protocol === "saml" && (
                  <button
                    type="button"
                    className="aw-btn"
                    onClick={() => void props.onViewMetadata(c.id)}
                  >
                    {t("actions.metadata")}
                  </button>
                )}
                <button
                  type="button"
                  className="aw-btn"
                  onClick={() => void props.onTest(c.id)}
                >
                  {t("actions.test")}
                </button>
                <button
                  type="button"
                  className="aw-btn"
                  onClick={() => props.onEdit(c)}
                >
                  {t("actions.edit")}
                </button>
                <button
                  type="button"
                  className="aw-btn"
                  data-variant="danger"
                  onClick={() => {
                    if (
                      typeof window !== "undefined" &&
                      window.confirm(
                        t("deleteConfirm", { provider: labelForProvider(c.provider) }),
                      )
                    ) {
                      void props.onDelete(c.id);
                    }
                  }}
                >
                  {t("actions.delete")}
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CreateForm(props: {
  t: Translator;
  onCancel: () => void;
  onSubmit: (input: {
    provider: SSOProvider;
    protocol: SSOProtocol;
    display_name?: string;
    metadata_xml?: string;
    oidc_discovery_url?: string;
    oidc_client_id?: string;
    oidc_client_secret?: string;
  }) => void | Promise<void>;
}): ReactElement {
  const { t } = props;
  const [provider, setProvider] = useState<SSOProvider>("okta");
  const [protocol, setProtocol] = useState<SSOProtocol>("saml");
  const [displayName, setDisplayName] = useState("");
  const [metadataXml, setMetadataXml] = useState("");
  const [oidcDiscovery, setOidcDiscovery] = useState("");
  const [oidcClientId, setOidcClientId] = useState("");
  const [oidcClientSecret, setOidcClientSecret] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const supported =
    PROVIDERS.find((p) => p.value === provider)?.protocols ?? ["saml"];
  if (!supported.includes(protocol)) {
    setProtocol(supported[0] ?? "saml");
  }

  return (
    <form
      className="aw-grid"
      onSubmit={async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
          await props.onSubmit({
            provider,
            protocol,
            display_name: displayName || undefined,
            metadata_xml: protocol === "saml" ? metadataXml || undefined : undefined,
            oidc_discovery_url:
              protocol === "oidc" ? oidcDiscovery || undefined : undefined,
            oidc_client_id:
              protocol === "oidc" ? oidcClientId || undefined : undefined,
            oidc_client_secret:
              protocol === "oidc" ? oidcClientSecret || undefined : undefined,
          });
        } finally {
          setSubmitting(false);
        }
      }}
    >
      <FormRow>
        <Field label={t("form.provider")}>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as SSOProvider)}
          >
            {PROVIDERS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("form.protocol")}>
          <select
            value={protocol}
            onChange={(e) => setProtocol(e.target.value as SSOProtocol)}
          >
            {supported.map((p) => (
              <option key={p} value={p}>
                {p.toUpperCase()}
              </option>
            ))}
          </select>
        </Field>
      </FormRow>
      <Field label={t("form.displayName")}>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder={t("form.displayNamePlaceholder")}
        />
      </Field>
      {protocol === "saml" ? (
        <Field label={t("form.metadataXml")}>
          <textarea
            value={metadataXml}
            onChange={(e) => setMetadataXml(e.target.value)}
            placeholder="<EntityDescriptor xmlns=&quot;urn:oasis:names:tc:SAML:2.0:metadata&quot;>…"
            spellCheck={false}
          />
        </Field>
      ) : (
        <>
          <Field label={t("form.oidcDiscovery")}>
            <input
              type="url"
              value={oidcDiscovery}
              onChange={(e) => setOidcDiscovery(e.target.value)}
              placeholder="https://acme.okta.com/.well-known/openid-configuration"
            />
          </Field>
          <FormRow>
            <Field label={t("form.clientId")}>
              <input
                type="text"
                value={oidcClientId}
                onChange={(e) => setOidcClientId(e.target.value)}
              />
            </Field>
            <Field label={t("form.clientSecret")}>
              <input
                type="password"
                value={oidcClientSecret}
                onChange={(e) => setOidcClientSecret(e.target.value)}
              />
            </Field>
          </FormRow>
        </>
      )}
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
          {submitting ? t("form.saving") : t("form.create")}
        </button>
      </div>
    </form>
  );
}

function EditForm(props: {
  t: Translator;
  connection: SSOConnection;
  onCancel: () => void;
  onSubmit: (
    patch: Partial<{
      display_name: string | null;
      metadata_xml: string;
      attribute_map: Record<string, string>;
      status: "active" | "suspended";
    }>,
  ) => void | Promise<void>;
}): ReactElement {
  const { t } = props;
  const [displayName, setDisplayName] = useState(props.connection.display_name ?? "");
  const [submitting, setSubmitting] = useState(false);

  return (
    <form
      className="aw-grid"
      onSubmit={async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
          await props.onSubmit({ display_name: displayName || null });
        } finally {
          setSubmitting(false);
        }
      }}
    >
      <h2>{t("edit.title", { provider: labelForProvider(props.connection.provider) })}</h2>
      <Field label={t("edit.displayName")}>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
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
          {t("save")}
        </button>
      </div>
    </form>
  );
}

function MetadataPanel(props: {
  t: Translator;
  xml: string;
  blobUrl: string | null;
  onClose: () => void;
}): ReactElement {
  const { t } = props;
  return (
    <div className="aw-grid" style={{ marginTop: 12 }}>
      <header>
        <h2>{t("metadataPanel.title")}</h2>
        <div className="aw-row">
          {props.blobUrl && (
            <a
              href={props.blobUrl}
              download="authio-sp-metadata.xml"
              className="aw-btn"
            >
              {t("metadataPanel.download")}
            </a>
          )}
          <button type="button" className="aw-btn" onClick={props.onClose}>
            {t("close")}
          </button>
        </div>
      </header>
      <textarea readOnly value={props.xml} style={{ minHeight: 200 }} />
    </div>
  );
}

function FormRow({ children }: { children: ReactNode }): ReactElement {
  return (
    <div
      className="aw-grid"
      style={{ gridTemplateColumns: "1fr 1fr", alignItems: "end" }}
    >
      {children}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}): ReactElement {
  return (
    <div>
      <label>{label}</label>
      {children}
    </div>
  );
}

function labelForProvider(p: SSOProvider): string {
  return PROVIDERS.find((x) => x.value === p)?.label ?? p;
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
// Imperative mount API for non-React hosts.
// =====================================================================

export interface MountedWidget {
  /** Update props on the mounted widget without unmounting (e.g. when
   * the host rotates the widget JWT). */
  update(opts: AuthioSSOConnectionWidgetProps): void;
  /** Unmount + tear down listeners + revoke any blob URLs. */
  unmount(): void;
}

export function mountSSOConnectionWidget(
  el: Element,
  opts: AuthioSSOConnectionWidgetProps,
): MountedWidget {
  let root: Root | null = createRoot(el);
  let current = opts;
  root.render(<AuthioSSOConnectionWidget {...current} />);
  return {
    update(next) {
      current = next;
      if (root) root.render(<AuthioSSOConnectionWidget {...current} />);
    },
    unmount() {
      if (root) {
        root.unmount();
        root = null;
      }
    },
  };
}
