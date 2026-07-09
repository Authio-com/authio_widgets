// Public surface for `@useauthio/widgets`. Re-exported so callers who
// want multiple widgets in one import (e.g. the dashboard playground)
// don't have to know about the per-widget sub-paths used by the
// per-widget bundle-size budgets.

// Round 1 — SSO Connection + Directory Sync
export {
  AuthioSSOConnectionWidget,
  mountSSOConnectionWidget,
} from "./sso-connection";
export type {
  AuthioSSOConnectionWidgetProps,
  SSOConnectionEvent,
  MountedWidget,
} from "./sso-connection";

export {
  AuthioDirectorySyncWidget,
  mountDirectorySyncWidget,
} from "./directory-sync";
export type {
  AuthioDirectorySyncWidgetProps,
  DirectorySyncEvent,
  MountedDirectoryWidget,
} from "./directory-sync";

// Round 2 — Audit Log, API Keys, User Sessions, Org Switcher
export {
  AuthioAuditLogWidget,
  mountAuditLogWidget,
} from "./audit-log";
export type {
  AuthioAuditLogWidgetProps,
  MountedAuditLogWidget,
} from "./audit-log";

export {
  AuthioAPIKeysWidget,
  mountAPIKeysWidget,
} from "./api-keys";
export type {
  AuthioAPIKeysWidgetProps,
  ApiKeyEvent,
  MountedAPIKeysWidget,
} from "./api-keys";

export {
  AuthioUserSessionsWidget,
  mountUserSessionsWidget,
} from "./user-sessions";
export type {
  AuthioUserSessionsWidgetProps,
  SessionEvent,
  MountedUserSessionsWidget,
} from "./user-sessions";

export {
  AuthioOrganizationSwitcherWidget,
  mountOrganizationSwitcherWidget,
} from "./organization-switcher";
export type {
  AuthioOrganizationSwitcherWidgetProps,
  MountedOrgSwitcherWidget,
} from "./organization-switcher";

export {
  AuthioPipesWidget,
  mountPipesWidget,
} from "./pipes";
export type {
  AuthioPipesWidgetProps,
  PipesConnectionEvent,
  MountedPipesWidget,
} from "./pipes";

export {
  AuthioDomainVerificationWidget,
  mountDomainVerificationWidget,
} from "./domain-verification";
export type {
  AuthioDomainVerificationWidgetProps,
  DomainVerificationEvent,
  MountedDomainVerificationWidget,
} from "./domain-verification";

export { WidgetClient } from "./client";
export { WidgetError } from "./errors";

// C7 — localization helpers. The `locale` prop on every widget is the
// primary surface; these are exported for embedders who want to resolve
// or enumerate locales themselves (e.g. to render a language picker that
// matches the widgets' supported set).
export {
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  resolveWidgetLocale,
  normalizeLocale,
  isSupportedLocale,
} from "./i18n";
export type { Locale } from "./i18n";

export type {
  AuditEvent,
  ApiKey,
  Directory,
  DirectoryProvider,
  DirectoryState,
  DirectoryUser,
  DomainChallengeRecord,
  OrgDomain,
  OrgMembership,
  PipesConnection,
  PipesProvider,
  PipesProviderId,
  SSOConnection,
  SSOProtocol,
  SSOProvider,
  SSOStatus,
  UserSession,
  WidgetClientOptions,
  WidgetScope,
  WidgetTokenClaims,
} from "./types";
