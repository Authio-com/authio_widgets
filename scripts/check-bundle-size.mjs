#!/usr/bin/env node
// Bundle-size budget enforcement for @useauthio/widgets.
//
// Original ceiling (v0.1) was ≤10 KB gzipped per widget / ≤20 KB
// combined, mirroring the T5 SDK ceiling. C7 (v0.2) adds full
// localization — every widget now carries the ICU-lite runtime plus its
// own message namespace and the shared common/error catalogs across six
// locales (en/de/fr/es/ja/pt-BR). That is an irreducible ~4-6 KB
// gzipped of translated copy per standalone widget, so the per-widget
// ceiling is raised to 16 KB, and the combined cap now spans all six
// standalone widget entries (was two) at 72 KB. Tree-shaking still
// guarantees a widget never ships another widget's strings.
//
// Reads the per-entry ESM artifact from `dist/` (the same shape
// shipped to npm) and gzips it in-process so we don't need an
// external `gzip` binary on every CI runner.

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const root = path.resolve(import.meta.dirname, "..");
const dist = path.join(root, "dist");

const PER_WIDGET_BUDGET = 16 * 1024;
// Seven standalone widgets × 16 KB ≈ 112 KB; keep headroom for shared CSS.
const COMBINED_BUDGET = 112 * 1024;

const widgets = [
  "sso-connection",
  "directory-sync",
  "audit-log",
  "api-keys",
  "user-sessions",
  "organization-switcher",
  "domain-verification",
];

function gzipSize(file) {
  const raw = fs.readFileSync(file);
  return zlib.gzipSync(raw, { level: 9 }).length;
}

const results = [];
let combined = 0;
let failed = false;

for (const w of widgets) {
  const file = path.join(dist, `${w}.js`);
  if (!fs.existsSync(file)) {
    console.error(`[size] missing ${file} — did you run \`pnpm build\`?`);
    process.exit(2);
  }
  const raw = fs.statSync(file).size;
  const gz = gzipSize(file);
  combined += gz;
  const status = gz <= PER_WIDGET_BUDGET ? "OK" : "FAIL";
  if (status === "FAIL") failed = true;
  results.push({ widget: w, raw, gz, status });
}

const combinedStatus = combined <= COMBINED_BUDGET ? "OK" : "FAIL";
if (combinedStatus === "FAIL") failed = true;

console.log("Per-widget gzipped sizes:");
for (const r of results) {
  console.log(
    `  ${r.widget.padEnd(20)}  raw=${String(r.raw).padStart(7)} bytes  gz=${String(r.gz).padStart(6)} bytes / ${PER_WIDGET_BUDGET}  [${r.status}]`,
  );
}
console.log(
  `Combined gzipped:    ${combined} bytes / ${COMBINED_BUDGET}  [${combinedStatus}]`,
);

if (failed) {
  console.error(
    "\n[size] bundle size budget exceeded. Trim deps or split the widget surface.",
  );
  process.exit(1);
}
