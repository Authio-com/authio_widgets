/**
 * <AuthioOrganizationSwitcherWidget /> — organization switcher for the
 * current user, backed by `auth-core /widget/organizations`.
 *
 * Scope: "organizations.read".
 * Requires widget JWT to carry `widget_user_id`.
 * Renders a dropdown / modal list of all orgs the user belongs to
 * with their role. Selecting an org calls `onOrgSwitch(orgId)` —
 * the customer's app handles the actual session context switch.
 */

import {
  type CSSProperties,
  type ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createRoot, type Root } from "react-dom/client";
import { WidgetClient } from "./client";
import { WidgetError } from "./errors";
import { humanizeError, makeTranslator, resolveWidgetLocale } from "./i18n";
import {
  common,
  error as errorCatalog,
  organizationSwitcher as catalog,
} from "./i18n/messages.gen";
import { ensureStylesInjected } from "./styles";
import type { OrgMembership, WidgetClientOptions } from "./types";

// =====================================================================
// Public component props
// =====================================================================

export interface AuthioOrganizationSwitcherWidgetProps extends WidgetClientOptions {
  /**
   * Fired when the user selects an organization. The customer's app
   * should call its own session-context-switch endpoint with the
   * returned orgId and then re-render (or redirect) the page.
   */
  onOrgSwitch: (orgId: string, org: OrgMembership) => void;
  /**
   * Fired when the user clicks "Add organization". If not provided,
   * the CTA is hidden.
   */
  onAddOrganization?: () => void;
  /** ID of the currently active org (highlighted in the list). */
  currentOrgId?: string;
  style?: CSSProperties;
  className?: string;
}

// =====================================================================
// React component
// =====================================================================

export function AuthioOrganizationSwitcherWidget(
  props: AuthioOrganizationSwitcherWidgetProps,
): ReactElement {
  const {
    style,
    className,
    onOrgSwitch,
    onAddOrganization,
    currentOrgId,
    ...clientOpts
  } = props;

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

  const [orgs, setOrgs] = useState<OrgMembership[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<WidgetError | null>(null);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const out = await client.fetch<{ data: OrgMembership[] }>("/widget/organizations");
      setOrgs(out.data);
    } catch (err) {
      setError(asWidget(err));
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void load();
  }, [load]);

  // Close dropdown when clicking outside.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const currentOrg = orgs?.find((o) => o.id === currentOrgId) ?? orgs?.[0];

  const handleSelect = useCallback(
    (org: OrgMembership) => {
      setOpen(false);
      onOrgSwitch(org.id, org);
    },
    [onOrgSwitch],
  );

  return (
    <div
      data-authio-widget="organization-switcher"
      data-theme={clientOpts.theme ?? "light"}
      className={className}
      style={style}
      ref={containerRef}
    >
      {/* Trigger button */}
      <button
        type="button"
        className="aw-btn"
        style={{ width: "100%", justifyContent: "space-between" }}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={loading}
      >
        <span>
          {loading ? (
            <><span className="aw-spinner" />&nbsp;{t("loading")}</>
          ) : currentOrg ? (
            currentOrg.name
          ) : (
            t("select")
          )}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="currentColor"
          style={{ transform: open ? "rotate(180deg)" : undefined }}
        >
          <path d="M6 8L1 3h10z" />
        </svg>
      </button>

      {error && (
        <div className="aw-error" role="alert" style={{ marginTop: 8 }}>
          {describeError(error)}{" "}
          <span style={{ opacity: 0.7 }}>({error.code})</span>
        </div>
      )}

      {/* Dropdown */}
      {open && (
        <div
          role="listbox"
          aria-label={t("ariaLabel")}
          style={{
            position: "absolute",
            zIndex: 100,
            marginTop: 4,
            minWidth: 240,
            background: "var(--aw-bg)",
            border: "1px solid var(--aw-border)",
            borderRadius: "var(--aw-radius)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.10)",
            overflow: "hidden",
          }}
        >
          {orgs && orgs.length > 0 ? (
            orgs.map((org) => (
              <button
                key={org.id}
                type="button"
                role="option"
                aria-selected={org.id === currentOrgId}
                style={{
                  display: "flex",
                  width: "100%",
                  padding: "10px 14px",
                  border: "none",
                  background:
                    org.id === currentOrgId
                      ? "rgba(37,99,235,0.08)"
                      : "transparent",
                  cursor: "pointer",
                  textAlign: "left",
                  alignItems: "center",
                  gap: 10,
                  borderBottom: "1px solid var(--aw-border)",
                }}
                onClick={() => handleSelect(org)}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 6,
                    background: "rgba(37,99,235,0.15)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 14,
                    fontWeight: 600,
                    color: "var(--aw-accent)",
                    flexShrink: 0,
                  }}
                >
                  {org.name.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.2 }}>
                    {org.name}
                  </div>
                  <div className="aw-muted" style={{ fontSize: 11, marginTop: 2 }}>
                    {org.slug} · {org.role}
                  </div>
                </div>
                {org.id === currentOrgId && (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="var(--aw-accent)"
                  >
                    <path d="M2 7l4 4 6-7" stroke="var(--aw-accent)" strokeWidth="2" fill="none" strokeLinecap="round" />
                  </svg>
                )}
              </button>
            ))
          ) : (
            <div className="aw-muted" style={{ padding: "10px 14px", fontSize: 13 }}>
              {t("empty")}
            </div>
          )}

          {onAddOrganization && (
            <button
              type="button"
              style={{
                display: "flex",
                width: "100%",
                padding: "10px 14px",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                textAlign: "left",
                alignItems: "center",
                gap: 10,
                color: "var(--aw-accent)",
                fontSize: 13,
                fontWeight: 500,
              }}
              onClick={() => {
                setOpen(false);
                onAddOrganization();
              }}
            >
              <span style={{ fontSize: 18, lineHeight: 1 }}>+</span>
              {t("addOrganization")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// =====================================================================
// Imperative mount API
// =====================================================================

export interface MountedOrgSwitcherWidget {
  update(opts: AuthioOrganizationSwitcherWidgetProps): void;
  unmount(): void;
}

export function mountOrganizationSwitcherWidget(
  el: Element,
  opts: AuthioOrganizationSwitcherWidgetProps,
): MountedOrgSwitcherWidget {
  let root: Root | null = createRoot(el);
  let current = opts;
  root.render(<AuthioOrganizationSwitcherWidget {...current} />);
  return {
    update(next) {
      current = next;
      if (root) root.render(<AuthioOrganizationSwitcherWidget {...current} />);
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
