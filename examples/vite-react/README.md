# @useauthio/widgets · Vite React example

Mounts both widgets in a third-party app shell. Demonstrates the
intended embed model: the customer's BFF mints a `kind: "widget"`
JWT, hands it to the SPA, and the widgets render against the
auth-core `/widget/*` API surface.

## Run

```bash
pnpm install
pnpm build
pnpm --filter authio-widgets-vite-example dev
```

Open <http://localhost:5173>, paste a widget JWT minted by your
backend, and click **Mount widgets**.

## Mint a token

```bash
curl -X POST https://api.authio.com/v1/widget-tokens \
  -H "authorization: Bearer $DASHBOARD_SESSION_JWT" \
  -H "x-authio-tenant: ten_abc" \
  -H "content-type: application/json" \
  -d '{
    "organization_id": "org_xyz",
    "scope": ["sso_connection", "directory_sync"],
    "origins": ["http://localhost:5173"],
    "ttl_seconds": 1800
  }'
```
