// Public type surface for `@useauthio/widgets`. Kept dependency-light so
// the type-only `import type` paths used by host apps don't pull the
// React runtime into their server bundles.

export type WidgetScope =
  | "sso_connection"
  | "directory_sync"
  | "audit_log.read"
  | "api_keys.manage"
  | "sessions.read"
  | "organizations.read"
  | "pipes.read"
  | "pipes.write";

/**
 * Optional client-side decoded shape of the widget JWT. The widgets
 * themselves do NOT verify the token — they pass it through to
 * `auth-core` which verifies signature, expiry, scope, origin, and
 * the DB-backed revocation row on every call. We expose the type
 * solely so host apps that decode the token for telemetry / debug
 * UIs share a vocabulary with the server.
 */
export interface WidgetTokenClaims {
  iss: string;
  /** Always the literal "widget" — the third JWT-kind alongside
   * "customer" and "platform" (see auth-core T6.0). */
  kind: "widget";
  tenant_id: string;
  organization_id: string;
  widget_scope: WidgetScope[];
  widget_origins: string[];
  exp: number;
  iat: number;
  jti: string;
}

/**
 * The minimum auth-core API URL the widget hits for `/widget/*`.
 * Defaults to the production auth-api when omitted; override for
 * staging / self-hosted deployments.
 */
export interface WidgetClientOptions {
  /** A `kind: "widget"` JWT minted via `POST /v1/widget-tokens`. */
  token: string;
  /**
   * Org id this widget instance scopes its reads / writes to. MUST
   * match the JWT's `organization_id` claim — auth-core 403s any
   * mismatch.
   */
  organizationId: string;
  /** auth-core base URL. Defaults to `https://auth-api.authio.com`. */
  apiUrl?: string;
  /**
   * Surface-mode hint. The widgets default to a light-mode neutral
   * Tailwind-free CSS skin so they can be embedded inside any host;
   * set "dark" if the host is dark-themed.
   */
  theme?: "light" | "dark";
  /**
   * Optional UI locale (C7). Accepts any BCP-47-ish tag — `de`,
   * `de-DE`, `pt`, `pt-BR`, `EN` — and is normalised to one of the
   * supported catalog locales (`en` `de` `fr` `es` `ja` `pt-BR`). When
   * omitted, the widget falls back to the host browser's language and
   * then to English, so existing embedders see no behaviour change.
   * The catalog format is shared verbatim with the hosted Lobby (B7).
   */
  locale?: string;
}

// =====================================================================
// SSO Connection types — mirror auth-core/migrations/0002_sso.sql.
// =====================================================================

export type SSOProtocol = "saml" | "oidc";

export type SSOProvider =
  | "okta"
  | "entra"
  | "google_workspace"
  | "ping"
  | "onelogin"
  | "jumpcloud"
  | "adfs"
  | "auth0"
  | "keycloak"
  | "rippling"
  | "generic_saml"
  | "generic_oidc";

export type SSOStatus = "pending" | "active" | "suspended";

export interface SSOConnection {
  id: string;
  organization_id: string;
  provider: SSOProvider;
  protocol: SSOProtocol;
  status: SSOStatus;
  display_name?: string | null;
  metadata?: Record<string, unknown>;
  attribute_map?: Record<string, string>;
  created_at: string;
  configured_at?: string | null;
  configured_by?: string | null;
}

// =====================================================================
// Directory Sync types — mirror auth-core/migrations/0007_scim.sql.
// =====================================================================

export type DirectoryProvider =
  | "okta"
  | "entra"
  | "google_workspace"
  | "rippling"
  | "jumpcloud"
  | "generic_scim";

export type DirectoryState = "active" | "paused" | "revoked";

export interface Directory {
  id: string;
  organization_id: string;
  name: string;
  provider: DirectoryProvider;
  state: DirectoryState;
  last_sync_at?: string | null;
  user_count?: number;
  group_count?: number;
  created_at: string;
}

export interface DirectoryUser {
  id: string;
  email: string;
  name?: string | null;
  external_id?: string | null;
  status: "active" | "suspended" | "deactivated";
  last_synced_at?: string | null;
}

// =====================================================================
// Pipes types — mirror pipes_providers + pipes_connections (migration 0075).
// =====================================================================

export type PipesProviderId = "google" | "slack" | "github" | "salesforce" | "hubspot";

export interface PipesProvider {
  id: PipesProviderId;
  display_name: string;
  description: string;
  icon_url: string;
}

export interface PipesConnection {
  id: string;
  provider_id: PipesProviderId;
  external_account_id: string;
  external_account_email?: string | null;
  external_account_display_name?: string | null;
  scopes: string[];
  token_expires_at?: string | null;
  created_at: string;
  updated_at: string;
}

// =====================================================================
// Audit log types — mirror audit_events table (migration 0001).
// =====================================================================

export interface AuditEvent {
  id: string;
  action: string;
  actor_type: string;
  actor_id?: string | null;
  target_type?: string | null;
  target_id?: string | null;
  ip?: string | null;
  created_at: string;
}

// =====================================================================
// API key types — mirror api_keys table (migration 0001).
// =====================================================================

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  created_at: string;
  last_used_at?: string | null;
  expires_at?: string | null;
  revoked_at?: string | null;
}

// =====================================================================
// Session types — mirror sessions table (migration 0001).
// =====================================================================

export interface UserSession {
  id: string;
  user_id: string;
  device?: string | null;
  browser?: string | null;
  ip?: string | null;
  location?: string | null;
  last_active_at: string;
  expires_at: string;
  issued_at: string;
  active_organization_id?: string | null;
}

// =====================================================================
// Organization (for switcher) — mirror organizations + memberships.
// =====================================================================

export interface OrgMembership {
  id: string;
  name: string;
  slug: string;
  role: string;
  status: string;
  joined_at: string;
}
