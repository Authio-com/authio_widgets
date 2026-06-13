import { useState } from "react";
import {
  AuthioAuditLogWidget,
  AuthioDirectorySyncWidget,
  AuthioSSOConnectionWidget,
} from "@useauthio/widgets";

/**
 * Demo app: paste a widget JWT minted from your backend (via
 * `POST /v1/widget-tokens` on `management-api`) and see the widgets
 * mount against the auth-core `/widget/*` API surface.
 *
 * In production you'd inject the token via SSR, a server-component
 * fetch, or a server-render template — never expose the customer
 * dashboard's session JWT to the browser. This demo's manual paste
 * box is dev-only.
 */
export function App() {
  const [token, setToken] = useState("");
  const [orgId, setOrgId] = useState("");
  const [apiUrl, setApiUrl] = useState("https://auth-api.authio.com");
  const [activeWidget, setActiveWidget] = useState<
    "sso" | "dirsync" | "audit" | "apikeys" | "sessions" | "orgs"
  >("sso");
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
        Embed Authio&apos;s SSO Connection + Directory Sync widgets inside
        your own product.
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
          The token must carry <code>kind: &quot;widget&quot;</code>, the
          org id you paste here, and{" "}
          <code>widget_origins: [&quot;{location.origin}&quot;]</code>.
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
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            {(["sso", "dirsync", "audit"] as const).map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setActiveWidget(w)}
                style={{
                  height: 32,
                  padding: "0 14px",
                  borderRadius: 4,
                  border: "1px solid #cbd5e1",
                  background: activeWidget === w ? "#2563eb" : "white",
                  color: activeWidget === w ? "white" : "#0f172a",
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                {w === "sso" ? "SSO Connection" : w === "dirsync" ? "Directory Sync" : "Audit Log"}
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
          {activeWidget === "audit" && (
            <AuthioAuditLogWidget
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
