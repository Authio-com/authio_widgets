# @useauthio/widgets

> Part of **[Authio Lobby](https://authio.com/products/lobby)** —
> Authio's drop-in passwordless authentication. The widgets are the
> embeddable Lobby pieces. Learn more at
> https://authio.com/products/lobby.

Drop-in React widgets that let your customers' IT admins configure
**SSO connections** and **Directory Sync** *inside your own product*
— no dashboard bounce.

## Install

```bash
pnpm add @useauthio/widgets react react-dom
```

## Quick start

```tsx
import {
  AuthioSSOConnectionWidget,
  AuthioDirectorySyncWidget,
} from "@useauthio/widgets";

function AdminPage({ token, orgId }: { token: string; orgId: string }) {
  return (
    <>
      <AuthioSSOConnectionWidget
        token={token}
        organizationId={orgId}
        onConnectionUpdate={(e) => console.log(e)}
      />
      <AuthioDirectorySyncWidget
        token={token}
        organizationId={orgId}
        onDirectoryUpdate={(e) => console.log(e)}
      />
    </>
  );
}
```

## Localization

Every widget renders in six languages — **English, German, French,
Spanish, Japanese, Brazilian Portuguese** — sharing the exact message
catalog the hosted Authio Lobby uses.

Pass the optional `locale` prop:

```tsx
<AuthioSSOConnectionWidget token={token} organizationId={orgId} locale="de" />
```

Resolution order: **`locale` prop → browser language
(`navigator.languages`) → `en`**. The prop is fully additive — omit it
and the widget picks the host browser's language (then English), so
existing embedders see no change. Any BCP-47-ish tag works and is
normalised (`de-DE` → `de`, `pt`/`pt-PT` → `pt-BR`, `EN` → `en`).

Coded auth-core errors (`widget_origin_mismatch`,
`widget_token_expired`, …) are translated from the shared `error.*`
catalog; the raw code stays visible for support.

The supported set and resolver are exported for building your own
language picker:

```tsx
import { SUPPORTED_LOCALES, resolveWidgetLocale } from "@useauthio/widgets";
```

Under the hood: a ~1 KB ICU-lite formatter (`{var}` / `plural` /
`select`) backed by the platform's `Intl.PluralRules` — no
message-format dependency, no bundled CLDR tables. The canonical catalog
lives in `messages/<locale>.json`; `pnpm build` regenerates the
tree-shakeable per-namespace runtime via `scripts/build-messages.mjs`.

## Mint a widget token from your backend

The widgets accept short-lived `kind: "widget"` JWTs. Mint them
server-side via `POST /v1/widget-tokens` on `management-api`:

```ts
const res = await fetch("https://api.authio.com/v1/widget-tokens", {
  method: "POST",
  headers: {
    authorization: `Bearer ${dashboardSessionJwt}`,
    "content-type": "application/json",
    "x-authio-tenant": tenantId,
  },
  body: JSON.stringify({
    organization_id: "org_abc",
    scope: ["sso_connection", "directory_sync"],
    origins: ["https://app.acme.com"],
    ttl_seconds: 1800,
  }),
});
const { token, expires_at } = await res.json();
```

## Bundle budget

Both widgets ship under a strict size ceiling — failing the budget
breaks the build:

| Bundle                | Gzipped budget |
| --------------------- | -------------- |
| Per widget            | **≤ 16 KB**    |
| Combined (6 widgets)  | **≤ 72 KB**    |

Run `pnpm size` after `pnpm build` to verify. The ceiling grew in
v0.2 to absorb localization — every widget now ships its own strings in
six locales plus the shared `common`/`error` catalogs. Tree-shaking
still guarantees a widget never carries another widget's strings.

## Origin enforcement

Each widget JWT is bound to one or more `widget_origins`. Every call
to `auth-core` `/widget/*` validates the request's `Origin` header
against that allow-list and 403s on mismatch. This enforcement is
**server-side** — there is no client-side `frame-ancestors` CSP gate to
defeat.

## Imperative mount (non-React hosts)

```ts
import { mountSSOConnectionWidget } from "@useauthio/widgets";

const handle = mountSSOConnectionWidget(document.querySelector("#mount")!, {
  token,
  organizationId: "org_abc",
});

// later, when the host rotates the token:
handle.update({ token: newToken, organizationId: "org_abc" });

// on tear-down:
handle.unmount();
```

## What's in the box

- `<AuthioSSOConnectionWidget>` — list, create, edit, delete, and
  test SAML / OIDC connections. Renders the SP metadata XML so the
  IT admin can paste it into Okta / Entra / JumpCloud.
- `<AuthioDirectorySyncWidget>` — provision Okta SCIM, Microsoft
  Entra ID, Google Workspace, JumpCloud, Rippling, generic SCIM. List
  synced users, trigger a manual sync, rotate the directory bearer.
- `mountSSOConnectionWidget` / `mountDirectorySyncWidget` — framework-
  agnostic imperative mount for Vue, Svelte, Angular, vanilla DOM,
  Web Components, etc.
- `WidgetClient` + `WidgetError` — the underlying typed HTTP client,
  exposed for power users.

## Security model in one paragraph

Widget tokens are a third, fully separate JWT-kind alongside customer
and platform tokens. The bearer cannot mint other tokens, cannot drive
`/v1/sessions/*` or `/v1/me`, and is refused on every other Authio
surface with `widget_token_not_allowed_here`. Every `/widget/*` call
checks the request `Origin` against the JWT's `widget_origins[]`,
checks the per-route scope against `widget_scope[]`, and reads the
underlying `widget_tokens` row by JTI on every call so revocation is
DB-backed (not just JWT-exp). TTL defaults to 30 minutes; the DB
caps it at 1 hour. Full threat model: [docs.authio.com/widgets/security](https://docs.authio.com/widgets/security).

## Docs

- [docs.authio.com/widgets/overview](https://docs.authio.com/widgets/overview)
- [docs.authio.com/widgets/sso-connection](https://docs.authio.com/widgets/sso-connection)
- [docs.authio.com/widgets/directory-sync](https://docs.authio.com/widgets/directory-sync)
- [docs.authio.com/widgets/tokens](https://docs.authio.com/widgets/tokens)
- [docs.authio.com/widgets/security](https://docs.authio.com/widgets/security)

## Repo

[github.com/authio-com/authio_widgets](https://github.com/authio-com/authio_widgets)

## License

MIT.
