import { useState } from "react";
import {
  AuthioAPIKeysWidget,
  AuthioAuditLogWidget,
  AuthioDirectorySyncWidget,
  AuthioDomainVerificationWidget,
  AuthioOrganizationSwitcherWidget,
  AuthioSSOConnectionWidget,
  AuthioUserSessionsWidget,
} from "@useauthio/widgets";

type WidgetTab =
  | "sso"
  | "dirsync"
  | "domain"
  | "audit"
  | "apikeys"
  | "sessions"
  | "orgs";

const TABS: { id: WidgetTab; label: string }[] = [
  { id: "sso", label: "SSO Connection" },
  { id: "dirsync", label: "Directory Sync" },
  { id: "domain", label: "Domain Verification" },
  { id: "audit", label: "Audit Log" },
  { id: "apikeys", label: "API Keys" },
  { id: "sessions", label: "Sessions" },
  { id: "orgs", label: "Org Switcher" },
];

/**
 * Demo app: paste a widget JWT minted from your backend (via
 * `POST /v1/widget-tokens` on `management-api`) and see the widgets
 * mount against the auth-core `/widget/*` API surface.
 *
 * In production you'd inject the token via SSR, a server-component
 * fetch, or a server-render template — never expose the customer
 * dashboard's session JWT to the browser. This demo's manual paste
 * box is dev-only.
 *
 * Mint scopes for a full Admin Portal demo:
 *   ["sso_connection","directory_sync","domain_verification",
 *    "audit_log.read","api_keys.manage","sessions.read","organizations.read"]
 * (sessions.read / organizations.read also require user_id.)
 */
export function App() {
  const [token, setToken] = useState("");
  const [orgId, setOrgId] = useState("");
  const [apiUrl, setApiUrl] = useState("https://identity.authio.com");
  const [activeWidget, setActiveWidget] = useState<WidgetTab>("sso");
  const [submitted, setSubmitted] = useState(false);

  return (
    <main
      style={{
        maxWidth: 880,
        margin: "32px auto",
        padding: 16,
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>@useauthio/widgets demo</h1>
      <p style={{ color: "#64748b", marginTop: 0 }}>
        Embed Authio Admin Portal widgets — SSO, Directory Sync, Domain
        Verification, and more — inside your own product.
      </p>

      <section
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          padding: 16,
          marginBottom: 24,
          background: "#f8fafc",
        }}
      >
        <h2 style={{ fontSize: 16, marginTop: 0 }}>Widget token</h2>
        <p style={{ color: "#64748b", fontSize: 13, marginTop: 0 }}>
          Mint one via <code>POST /v1/widget-tokens</code> on management-api.
          The token must carry <code>kind: &quot;widget&quot;</code>, the org
          id you paste here, and{" "}
          <code>widget_origins: [&quot;{typeof location !== "undefined" ? location.origin : "https://…"}&quot;]</code>.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitted(Boolean(token && orgId));
          }}
          style={{ display: "grid", gap: 8 }}
        >
          <label style={{ fontSize: 12, color: "#64748b" }}>
            JWT
            <textarea
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required
              spellCheck={false}
              style={{
                width: "100%",
                minHeight: 64,
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: 12,
                padding: 8,
                borderRadius: 4,
                border: "1px solid #cbd5e1",
              }}
            />
          </label>
          <label style={{ fontSize: 12, color: "#64748b" }}>
            organization_id
            <input
              type="text"
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              required
              placeholder="org_abc…"
              style={{
                width: "100%",
                height: 32,
                padding: "0 8px",
                borderRadius: 4,
                border: "1px solid #cbd5e1",
              }}
            />
          </label>
          <label style={{ fontSize: 12, color: "#64748b" }}>
            auth-core API URL
            <input
              type="url"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              style={{
                width: "100%",
                height: 32,
                padding: "0 8px",
                borderRadius: 4,
                border: "1px solid #cbd5e1",
              }}
            />
          </label>
          <button
            type="submit"
            style={{
              alignSelf: "flex-end",
              height: 32,
              padding: "0 16px",
              background: "#2563eb",
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            Mount widgets
          </button>
        </form>
      </section>

      {submitted && (
        <>
          <div
            style={{
              display: "flex",
              gap: 8,
              marginBottom: 16,
              flexWrap: "wrap",
            }}
          >
            {TABS.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => setActiveWidget(w.id)}
                style={{
                  height: 32,
                  padding: "0 14px",
                  borderRadius: 4,
                  border: "1px solid #cbd5e1",
                  background: activeWidget === w.id ? "#2563eb" : "white",
                  color: activeWidget === w.id ? "white" : "#0f172a",
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                {w.label}
              </button>
            ))}
          </div>

          {activeWidget === "sso" && (
            <AuthioSSOConnectionWidget
              token={token}
              organizationId={orgId}
              apiUrl={apiUrl}
              onConnectionUpdate={(e) => console.log("[sso]", e)}
            />
          )}
          {activeWidget === "dirsync" && (
            <AuthioDirectorySyncWidget
              token={token}
              organizationId={orgId}
              apiUrl={apiUrl}
              onDirectoryUpdate={(e) => console.log("[dirsync]", e)}
            />
          )}
          {activeWidget === "domain" && (
            <AuthioDomainVerificationWidget
              token={token}
              organizationId={orgId}
              apiUrl={apiUrl}
              onDomainUpdate={(e) => console.log("[domain]", e)}
            />
          )}
          {activeWidget === "audit" && (
            <AuthioAuditLogWidget
              token={token}
              organizationId={orgId}
              apiUrl={apiUrl}
            />
          )}
          {activeWidget === "apikeys" && (
            <AuthioAPIKeysWidget
              token={token}
              organizationId={orgId}
              apiUrl={apiUrl}
              onKeyCreated={(e) => console.log("[apikeys]", e)}
            />
          )}
          {activeWidget === "sessions" && (
            <AuthioUserSessionsWidget
              token={token}
              organizationId={orgId}
              apiUrl={apiUrl}
            />
          )}
          {activeWidget === "orgs" && (
            <AuthioOrganizationSwitcherWidget
              token={token}
              organizationId={orgId}
              apiUrl={apiUrl}
            />
          )}
        </>
      )}
    </main>
  );
}
