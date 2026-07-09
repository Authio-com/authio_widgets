import { defineConfig } from "tsup";

// One entry per public widget so per-widget tree-shaking + per-widget bundle
// size budgets work cleanly. The `index.ts` barrel re-exports both for
// callers who want both widgets in one import.
export default defineConfig({
  entry: {
    index: "src/index.ts",
    "sso-connection": "src/sso-connection.tsx",
    "directory-sync": "src/directory-sync.tsx",
    // Round 2
    "audit-log": "src/audit-log.tsx",
    "api-keys": "src/api-keys.tsx",
    "user-sessions": "src/user-sessions.tsx",
    "organization-switcher": "src/organization-switcher.tsx",
    "domain-verification": "src/domain-verification.tsx",
  },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
  outDir: "dist",
  treeshake: true,
  // Each widget entry stays standalone (no code-splitting) so a single
  // embed is one self-contained file with no chunk-load waterfall, and
  // so the per-entry bundle-size budget stays meaningful. Tree-shaking
  // still prunes every message namespace a given widget doesn't import
  // (each namespace is a separate named export in messages.gen.ts), so
  // the SSO widget never ships the audit-log strings. The cost that does
  // land in every widget is C7's localization: the ICU-lite runtime plus
  // that widget's own namespace and the shared common/error catalogs
  // across all six locales — which is why the budget below grew.
  splitting: false,
  external: ["react", "react-dom", "@useauthio/node"],
});
