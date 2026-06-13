# Changelog

All notable changes to `@useauthio/widgets`.

## 0.2.0 — 2026-06-11

**Widget localization.** Every widget now renders in six languages —
English, German, French, Spanish, Japanese, and Brazilian Portuguese —
reusing the same message-catalog contract the hosted Lobby ships.

- **Additive `locale` prop** on all widgets (and the imperative
  `mount*` APIs via `WidgetClientOptions`). Accepts any BCP-47-ish tag
  (`de`, `de-DE`, `pt`, `pt-BR`, `EN`); resolution order is
  **`locale` prop → browser language (`navigator.languages`) → `en`**.
  Omitting it is a no-op for existing embedders — the default resolves to
  the host browser language, then English.
- **Catalog:** hand-authored `messages/<locale>.json` (nested JSON + ICU
  MessageFormat), widget-scoped namespaces (`widgets.ssoConnection.*`,
  …), shared `widgets.common.*`, and `error.*` keyed on stable auth-core
  error codes so coded errors are translatable (the raw code stays
  visible in the muted suffix). A key-parity test guards all six locales.
- **Runtime:** a ~1 KB ICU-lite formatter (`{var}`, `plural`, `select`)
  that delegates plural-category selection to the platform's
  `Intl.PluralRules` — no message-format library, no bundled CLDR data.
  Per-namespace generated exports (`scripts/build-messages.mjs` →
  `src/i18n/messages.gen.ts`) keep each widget tree-shaken to only its
  own strings.
- **Bundle budget** raised to ≤16 KB gzipped per widget (was 10 KB) to
  account for shipping six locales of translated copy; tree-shaking still
  guarantees a widget never carries another widget's strings.
- Exposes `SUPPORTED_LOCALES`, `resolveWidgetLocale`, `normalizeLocale`,
  `isSupportedLocale`, and the `Locale` type for embedders building their
  own language pickers.

## 0.1.0 — 2026-05-23

Initial release: drop-in React widgets so customers' IT admins can
configure SSO connections + Directory Sync inside the customer's own
product without bouncing through the Authio admin portal.

- `<AuthioSSOConnectionWidget />` — list / create / edit / delete /
  test SAML + OIDC SSO connections for one organization. Renders the
  SP metadata XML so the IT admin can paste it into Okta / Entra /
  etc.
- `<AuthioDirectorySyncWidget />` — provision Okta SCIM / Entra /
  Google Workspace directories, list synced users, trigger an
  on-demand sync, rotate the directory bearer token.
- Imperative `mountSSOConnectionWidget(el, opts)` /
  `mountDirectorySyncWidget(el, opts)` for non-React hosts.

Bundle budget: ≤10 KB gzipped per widget, ≤20 KB combined. The build
script (`pnpm size`) fails the build if either ceiling is breached.

Authentication: each widget consumes a short-lived `kind: "widget"`
JWT minted by the customer's BFF via `POST /v1/widget-tokens` on
`management-api`. Origin enforcement is server-side: the widget
token's `widget_origins[]` claim is checked against the request's
`Origin` header on every call to `/widget/*` on `auth-core`.

## [0.3.0] — 2026-06-12

### Changed
- **Renamed npm package `@authio/widgets` → `@useauthio/widgets`.** The
  original `@authio` scope could not be claimed on npm, so every Authio
  SDK now publishes under the organization scope `@useauthio`. Install
  with `npm install @useauthio/widgets` and update imports accordingly.
  The old `@authio/widgets` name is retired; releases below this entry were
  published (or prepared) under the old name and are kept for history.

