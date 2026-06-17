/**
 * <AuthioDirectorySyncWidget /> — drop-in Directory Sync (SCIM)
 * provisioning surface backed by `auth-core /widget/directories/*`.
 *
 * Supports the four big provider presets (Okta, Entra, Google
 * Workspace, generic SCIM), plus the manual sync trigger + bearer-token
 * rotation an IT admin needs after the IdP-side configuration is live.
 *
 * Same auth + origin-enforcement contract as the SSO Connection
 * widget — see ./sso-connection.tsx for the threat model.
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
  directorySync as catalog,
  error as errorCatalog,
} from "./i18n/messages.gen";
import { ensureStylesInjected } from "./styles";
import type {
  Directory,
  DirectoryGroup,
  DirectoryProvider,
  DirectoryUser,
  WidgetClientOptions,
} from "./types";

const DIRECTORY_PROVIDERS: { value: DirectoryProvider; label: string }[] = [
  { value: "okta", label: "Okta SCIM" },
  { value: "entra", label: "Microsoft Entra ID (Azure AD)" },
  { value: "google_workspace", label: "Google Workspace" },
  { value: "rippling", label: "Rippling" },
  { value: "jumpcloud", label: "JumpCloud" },
  { value: "generic_scim", label: "Generic SCIM 2.0" },
];

export interface AuthioDirectorySyncWidgetProps extends WidgetClientOptions {
  onDirectoryUpdate?: (event: DirectorySyncEvent) => void;
  style?: CSSProperties;
  className?: string;
}

export type DirectorySyncEvent =
  | { type: "loaded"; directories: Directory[] }
  | {
      type: "provisioned";
      directory: Directory;
      bearer_token: string;
      scim_endpoint: string;
    }
  | { type: "updated"; directory: Directory }
  | { type: "deleted"; directoryId: string }
  | { type: "synced"; directoryId: string }
  | { type: "rotated"; directoryId: string; bearer_token: string }
  | { type: "error"; error: WidgetError };

export function AuthioDirectorySyncWidget(
  props: AuthioDirectorySyncWidgetProps,
): ReactElement {
  const { onDirectoryUpdate, style, className, ...clientOpts } = props;

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

  const [directories, setDirectories] = useState<Directory[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<WidgetError | null>(null);
  const [adding, setAdding] = useState(false);
  const [provisionedSecret, setProvisionedSecret] = useState<{
    directoryId: string;
    bearerToken: string;
    scimEndpoint: string;
  } | null>(null);
  const [usersFor, setUsersFor] = useState<{
    directoryId: string;
    users: DirectoryUser[];
    loading: boolean;
  } | null>(null);
  const [groupsFor, setGroupsFor] = useState<{
    directoryId: string;
    groups: DirectoryGroup[];
    loading: boolean;
  } | null>(null);

  // Track blob URLs the same way the SSO widget does — host pages
  // that mount + unmount the widget many times shouldn't leak
  // memory.
  const blobUrlsRef = useRef<string[]>([]);
  useEffect(
    () => () => {
      for (const u of blobUrlsRef.current) URL.revokeObjectURL(u);
      blobUrlsRef.current = [];
    },
    [],
  );

  const emit = useCallback(
    (e: DirectorySyncEvent) => onDirectoryUpdate?.(e),
    [onDirectoryUpdate],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const out = await client.fetch<{ data: Directory[] }>(
        "/widget/directories",
      );
      setDirectories(out.data);
      emit({ type: "loaded", directories: out.data });
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

  const handleProvision = useCallback(
    async (input: { provider: DirectoryProvider; name: string }) => {
      try {
        const created = await client.fetch<{
          directory: Directory;
          bearer_token: string;
          scim_endpoint: string;
        }>("/widget/directories", { method: "POST", body: input });
        setDirectories((prev) =>
          prev
            ? [created.directory, ...prev.filter((d) => d.id !== created.directory.id)]
            : [created.directory],
        );
        setAdding(false);
        setProvisionedSecret({
          directoryId: created.directory.id,
          bearerToken: created.bearer_token,
          scimEndpoint: created.scim_endpoint,
        });
        emit({
          type: "provisioned",
          directory: created.directory,
          bearer_token: created.bearer_token,
          scim_endpoint: created.scim_endpoint,
        });
      } catch (err) {
        const e = asWidget(err);
        setError(e);
        emit({ type: "error", error: e });
      }
    },
    [client, emit],
  );

  const handleDelete = useCallback(
    async (directoryId: string) => {
      try {
        await client.fetch<void>(`/widget/directories/${directoryId}`, {
          method: "DELETE",
        });
        setDirectories((prev) =>
          prev ? prev.filter((d) => d.id !== directoryId) : prev,
        );
        emit({ type: "deleted", directoryId });
      } catch (err) {
        const e = asWidget(err);
        setError(e);
        emit({ type: "error", error: e });
      }
    },
    [client, emit],
  );

  const handleSyncNow = useCallback(
    async (directoryId: string) => {
      try {
        await client.fetch<{ ok: boolean }>(
          `/widget/directories/${directoryId}/sync-now`,
          { method: "POST" },
        );
        emit({ type: "synced", directoryId });
        await refresh();
      } catch (err) {
        const e = asWidget(err);
        setError(e);
        emit({ type: "error", error: e });
      }
    },
    [client, emit, refresh],
  );

  const handleRotateToken = useCallback(
    async (directoryId: string) => {
      try {
        const r = await client.fetch<{ bearer_token: string }>(
          `/widget/directories/${directoryId}`,
          { method: "PATCH", body: { rotate_token: true } },
        );
        setProvisionedSecret({
          directoryId,
          bearerToken: r.bearer_token,
          scimEndpoint:
            (directories ?? []).find((d) => d.id === directoryId)?.id
              ? `(see provisioning details)`
              : "",
        });
        emit({ type: "rotated", directoryId, bearer_token: r.bearer_token });
      } catch (err) {
        const e = asWidget(err);
        setError(e);
        emit({ type: "error", error: e });
      }
    },
    [client, directories, emit],
  );

  const handleViewUsers = useCallback(
    async (directoryId: string) => {
      setUsersFor({ directoryId, users: [], loading: true });
      setGroupsFor(null);
      try {
        const out = await client.fetch<{ data: DirectoryUser[] }>(
          `/widget/directories/${directoryId}/users`,
        );
        setUsersFor({ directoryId, users: out.data, loading: false });
      } catch (err) {
        setUsersFor({ directoryId, users: [], loading: false });
        const e = asWidget(err);
        setError(e);
        emit({ type: "error", error: e });
      }
    },
    [client, emit],
  );

  const handleViewGroups = useCallback(
    async (directoryId: string) => {
      setGroupsFor({ directoryId, groups: [], loading: true });
      setUsersFor(null);
      try {
        const out = await client.fetch<{ data: DirectoryGroup[] }>(
          `/widget/directories/${directoryId}/groups`,
        );
        setGroupsFor({ directoryId, groups: out.data, loading: false });
      } catch (err) {
        setGroupsFor({ directoryId, groups: [], loading: false });
        const e = asWidget(err);
        setError(e);
        emit({ type: "error", error: e });
      }
    },
    [client, emit],
  );

  return (
    <div
      data-authio-widget="directory-sync"
      data-theme={clientOpts.theme ?? "light"}
      className={className}
      style={style}
    >
      <header>
        <div>
          <h2>{t("title")}</h2>
          <p className="aw-muted">{t("subtitle")}</p>
        </div>
        {!adding && (
          <button
            type="button"
            className="aw-btn"
            data-variant="primary"
            onClick={() => {
              setAdding(true);
              setError(null);
            }}
          >
            {t("provision")}
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
        <ProvisionForm t={t} onCancel={() => setAdding(false)} onSubmit={handleProvision} />
      )}

      {provisionedSecret && (
        <SecretReveal
          t={t}
          directoryId={provisionedSecret.directoryId}
          bearerToken={provisionedSecret.bearerToken}
          scimEndpoint={provisionedSecret.scimEndpoint}
          onClose={() => setProvisionedSecret(null)}
        />
      )}

      {!adding && (
        <DirectoryList
          t={t}
          loading={loading}
          directories={directories ?? []}
          onDelete={handleDelete}
          onSyncNow={handleSyncNow}
          onRotateToken={handleRotateToken}
          onViewUsers={handleViewUsers}
          onViewGroups={handleViewGroups}
        />
      )}

      {usersFor && (
        <UsersPanel
          t={t}
          directoryId={usersFor.directoryId}
          users={usersFor.users}
          loading={usersFor.loading}
          onClose={() => setUsersFor(null)}
        />
      )}

      {groupsFor && (
        <GroupsPanel
          t={t}
          directoryId={groupsFor.directoryId}
          groups={groupsFor.groups}
          loading={groupsFor.loading}
          onClose={() => setGroupsFor(null)}
        />
      )}
    </div>
  );
}

// =====================================================================
// Subcomponents
// =====================================================================

function DirectoryList(props: {
  t: Translator;
  loading: boolean;
  directories: Directory[];
  onDelete: (id: string) => void | Promise<void>;
  onSyncNow: (id: string) => void | Promise<void>;
  onRotateToken: (id: string) => void | Promise<void>;
  onViewUsers: (id: string) => void | Promise<void>;
  onViewGroups: (id: string) => void | Promise<void>;
}): ReactElement {
  const { t } = props;
  if (props.loading) {
    return (
      <div className="aw-empty">
        <span className="aw-spinner" /> {t("loading")}
      </div>
    );
  }
  if (props.directories.length === 0) {
    return (
      <div className="aw-empty">{t("empty", { action: t("provision") })}</div>
    );
  }
  return (
    <table>
      <thead>
        <tr>
          <th>{t("columns.name")}</th>
          <th>{t("columns.provider")}</th>
          <th>{t("columns.state")}</th>
          <th>{t("columns.lastSync")}</th>
          <th aria-label="actions" />
        </tr>
      </thead>
      <tbody>
        {props.directories.map((d) => (
          <tr key={d.id}>
            <td>{d.name}</td>
            <td>{labelForProvider(d.provider)}</td>
            <td>
              <span
                className="aw-pill"
                data-tone={
                  d.state === "active"
                    ? "success"
                    : d.state === "revoked"
                      ? "danger"
                      : "muted"
                }
              >
                {t(`state.${d.state}`)}
              </span>
            </td>
            <td>
              {d.last_sync_at ? (
                new Date(d.last_sync_at).toLocaleString()
              ) : (
                <span className="aw-muted">{t("never")}</span>
              )}
            </td>
            <td>
              <div className="aw-row" style={{ justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="aw-btn"
                  onClick={() => void props.onViewUsers(d.id)}
                >
                  {t("actions.users")}
                </button>
                <button
                  type="button"
                  className="aw-btn"
                  onClick={() => void props.onViewGroups(d.id)}
                >
                  {t("actions.groups")}
                </button>
                <button
                  type="button"
                  className="aw-btn"
                  onClick={() => void props.onSyncNow(d.id)}
                >
                  {t("actions.syncNow")}
                </button>
                <button
                  type="button"
                  className="aw-btn"
                  onClick={() => void props.onRotateToken(d.id)}
                >
                  {t("actions.rotateToken")}
                </button>
                <button
                  type="button"
                  className="aw-btn"
                  data-variant="danger"
                  onClick={() => {
                    if (
                      typeof window !== "undefined" &&
                      window.confirm(t("deleteConfirm", { name: d.name }))
                    ) {
                      void props.onDelete(d.id);
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

function ProvisionForm(props: {
  t: Translator;
  onCancel: () => void;
  onSubmit: (input: {
    provider: DirectoryProvider;
    name: string;
  }) => void | Promise<void>;
}): ReactElement {
  const { t } = props;
  const [provider, setProvider] = useState<DirectoryProvider>("okta");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  return (
    <form
      className="aw-grid"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        setSubmitting(true);
        try {
          await props.onSubmit({ provider, name: name.trim() });
        } finally {
          setSubmitting(false);
        }
      }}
    >
      <Field label={t("form.displayName")}>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("form.displayNamePlaceholder")}
          required
        />
      </Field>
      <Field label={t("form.provider")}>
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value as DirectoryProvider)}
        >
          {DIRECTORY_PROVIDERS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
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
          disabled={submitting || !name.trim()}
        >
          {submitting ? t("form.provisioning") : t("form.provision")}
        </button>
      </div>
    </form>
  );
}

function SecretReveal(props: {
  t: Translator;
  directoryId: string;
  bearerToken: string;
  scimEndpoint: string;
  onClose: () => void;
}): ReactElement {
  const { t } = props;
  const onCopy = useCallback(
    (value: string) => {
      if (
        typeof navigator !== "undefined" &&
        navigator.clipboard?.writeText
      ) {
        void navigator.clipboard.writeText(value);
      }
    },
    [],
  );
  return (
    <div
      className="aw-grid"
      style={{
        marginTop: 12,
        padding: 12,
        border: "1px solid var(--aw-accent)",
        borderRadius: 6,
      }}
    >
      <header>
        <h2>{t("secret.title")}</h2>
        <button type="button" className="aw-btn" onClick={props.onClose}>
          {t("secret.done")}
        </button>
      </header>
      <p className="aw-muted">{t("secret.warning")}</p>
      <Field label={t("secret.scimEndpoint")}>
        <div className="aw-row">
          <input type="text" readOnly value={props.scimEndpoint} />
          <button
            type="button"
            className="aw-btn"
            onClick={() => onCopy(props.scimEndpoint)}
          >
            {t("copy")}
          </button>
        </div>
      </Field>
      <Field label={t("secret.bearerToken")}>
        <div className="aw-row">
          <input type="text" readOnly value={props.bearerToken} />
          <button
            type="button"
            className="aw-btn"
            data-variant="primary"
            onClick={() => onCopy(props.bearerToken)}
          >
            {t("copy")}
          </button>
        </div>
      </Field>
    </div>
  );
}

function UsersPanel(props: {
  t: Translator;
  directoryId: string;
  users: DirectoryUser[];
  loading: boolean;
  onClose: () => void;
}): ReactElement {
  const { t } = props;
  return (
    <div className="aw-grid" style={{ marginTop: 12 }}>
      <header>
        <h2>{t("users.title", { count: props.users.length })}</h2>
        <button type="button" className="aw-btn" onClick={props.onClose}>
          {t("close")}
        </button>
      </header>
      {props.loading ? (
        <div className="aw-empty">
          <span className="aw-spinner" /> {t("users.loading")}
        </div>
      ) : props.users.length === 0 ? (
        <div className="aw-empty">{t("users.empty")}</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>{t("users.columns.email")}</th>
              <th>{t("users.columns.name")}</th>
              <th>{t("users.columns.status")}</th>
              <th>{t("users.columns.lastSynced")}</th>
            </tr>
          </thead>
          <tbody>
            {props.users.map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td>{u.name ?? <span className="aw-muted">{t("dash")}</span>}</td>
                <td>
                  <span
                    className="aw-pill"
                    data-tone={
                      u.status === "active"
                        ? "success"
                        : u.status === "deactivated"
                          ? "danger"
                          : "muted"
                    }
                  >
                    {t(`users.status.${u.status}`)}
                  </span>
                </td>
                <td>
                  {u.last_synced_at ? (
                    new Date(u.last_synced_at).toLocaleString()
                  ) : (
                    <span className="aw-muted">{t("dash")}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function GroupsPanel(props: {
  t: Translator;
  directoryId: string;
  groups: DirectoryGroup[];
  loading: boolean;
  onClose: () => void;
}): ReactElement {
  const { t } = props;
  return (
    <div className="aw-grid" style={{ marginTop: 12 }}>
      <header>
        <h2>{t("groups.title", { count: props.groups.length })}</h2>
        <button type="button" className="aw-btn" onClick={props.onClose}>
          {t("close")}
        </button>
      </header>
      {props.loading ? (
        <div className="aw-empty">
          <span className="aw-spinner" /> {t("groups.loading")}
        </div>
      ) : props.groups.length === 0 ? (
        <div className="aw-empty">{t("groups.empty")}</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>{t("groups.columns.name")}</th>
              <th>{t("groups.columns.members")}</th>
              <th>{t("groups.columns.lastUpdated")}</th>
            </tr>
          </thead>
          <tbody>
            {props.groups.map((g) => (
              <tr key={g.id}>
                <td>
                  {g.display_name}
                  {g.external_id && (
                    <span className="aw-muted"> ({g.external_id})</span>
                  )}
                </td>
                <td>{g.member_count}</td>
                <td>
                  {g.last_updated_at ? (
                    new Date(g.last_updated_at).toLocaleString()
                  ) : (
                    <span className="aw-muted">{t("dash")}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
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

function labelForProvider(p: DirectoryProvider): string {
  return DIRECTORY_PROVIDERS.find((x) => x.value === p)?.label ?? p;
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
// Imperative mount API
// =====================================================================

export interface MountedDirectoryWidget {
  update(opts: AuthioDirectorySyncWidgetProps): void;
  unmount(): void;
}

export function mountDirectorySyncWidget(
  el: Element,
  opts: AuthioDirectorySyncWidgetProps,
): MountedDirectoryWidget {
  let root: Root | null = createRoot(el);
  let current = opts;
  root.render(<AuthioDirectorySyncWidget {...current} />);
  return {
    update(next) {
      current = next;
      if (root) root.render(<AuthioDirectorySyncWidget {...current} />);
    },
    unmount() {
      if (root) {
        root.unmount();
        root = null;
      }
    },
  };
}
