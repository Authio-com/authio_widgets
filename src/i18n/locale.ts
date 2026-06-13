/**
 * Locale registry + resolution for `@useauthio/widgets`.
 *
 * Mirrors the resolution contract the hosted Lobby ships so the
 * embeddable widgets speak the exact same locale vocabulary as the
 * hosted UI. The only difference is the *signals*: a widget runs in the
 * host page, not
 * behind Next.js middleware, so there is no `Accept-Language` header or
 * server cookie to read. The precedence is therefore:
 *
 *   1. explicit  — the `locale` prop on the widget (e.g. `locale="de"`)
 *   2. browser   — `navigator.languages` (quality-ordered) → `navigator.language`
 *   3. fallback  — `en` (never blank/broken)
 *
 * Region + case folding is handled exactly as in Lobby: `de-DE` → `de`,
 * `pt`/`pt-PT`/`pt-br` → `pt-BR`, `EN` → `en`, etc.
 */

export const SUPPORTED_LOCALES = ["en", "de", "fr", "es", "ja", "pt-BR"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

const CANONICAL_BY_LOWER: Record<string, Locale> = (() => {
  const map: Record<string, Locale> = {};
  for (const loc of SUPPORTED_LOCALES) {
    map[loc.toLowerCase()] = loc;
    const base = loc.split("-")[0]!.toLowerCase();
    if (!(base in map)) map[base] = loc;
  }
  return map;
})();

export function isSupportedLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" &&
    (SUPPORTED_LOCALES as readonly string[]).includes(value)
  );
}

/**
 * Normalise an arbitrary locale-ish string to a supported {@link Locale},
 * or `null` when nothing matches. Handles case folding and region
 * subtags (`DE`, `de-DE`, `pt`, `pt-pt` → a supported locale).
 */
export function normalizeLocale(raw: string | null | undefined): Locale | null {
  if (!raw) return null;
  const cleaned = raw.trim().toLowerCase();
  if (!cleaned) return null;
  if (CANONICAL_BY_LOWER[cleaned]) return CANONICAL_BY_LOWER[cleaned]!;
  const base = cleaned.split("-")[0]!;
  return CANONICAL_BY_LOWER[base] ?? null;
}

/**
 * Best supported locale from the browser's language preferences, in
 * quality order. Returns `null` when none match (caller falls back to
 * {@link DEFAULT_LOCALE}). SSR-safe: returns `null` when there is no
 * `navigator`.
 */
export function localeFromBrowser(
  nav: { language?: string; languages?: readonly string[] } | undefined = typeof navigator !==
  "undefined"
    ? navigator
    : undefined,
): Locale | null {
  if (!nav) return null;
  const candidates = [
    ...(nav.languages ?? []),
    ...(nav.language ? [nav.language] : []),
  ];
  for (const tag of candidates) {
    const match = normalizeLocale(tag);
    if (match) return match;
  }
  return null;
}

/**
 * Resolve the effective widget locale from the available signals, in
 * the precedence order defined above. The result is always a supported
 * locale.
 */
export function resolveWidgetLocale(
  explicit?: string | null,
  nav?: { language?: string; languages?: readonly string[] },
): Locale {
  return (
    normalizeLocale(explicit) ??
    localeFromBrowser(nav) ??
    DEFAULT_LOCALE
  );
}
