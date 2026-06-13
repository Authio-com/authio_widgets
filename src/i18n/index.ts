/**
 * Tiny translation runtime for `@useauthio/widgets`.
 *
 * A widget passes the per-namespace catalog slice it cares about (e.g.
 * the generated `ssoConnection` export — see `messages.gen.ts`) plus a
 * resolved {@link Locale}; it gets back a `t(key, values?)` function.
 *
 * Why a per-namespace slice rather than the whole catalog? The widgets
 * are embeddable and bundle-budget-constrained (≤10 KB gzipped each).
 * The canonical, hand-authored catalog lives in `messages/<locale>.json`,
 * but `scripts/build-messages.mjs` splits it into
 * per-namespace named exports so esbuild tree-shakes everything a given
 * widget doesn't reference. The SSO widget never pays for the audit-log
 * strings, and so on.
 *
 * Missing keys fall back to the `en` catalog, then to the raw key — a
 * partially-translated locale degrades to English, never to a blank.
 */

import { formatMessage, type FormatValues } from "./format";
import { type Locale } from "./locale";

export { SUPPORTED_LOCALES, DEFAULT_LOCALE, resolveWidgetLocale, normalizeLocale, isSupportedLocale } from "./locale";
export type { Locale } from "./locale";
export type { FormatValues } from "./format";

type NestedMessages = { [key: string]: string | NestedMessages };

/** A catalog slice keyed by locale, e.g. `{ en: {...}, de: {...} }`. */
export type LocaleCatalog = Partial<Record<Locale, NestedMessages>> & {
  en: NestedMessages;
};

export type Translator = (key: string, values?: FormatValues) => string;

function lookup(tree: NestedMessages | undefined, key: string): string | undefined {
  if (!tree) return undefined;
  let node: string | NestedMessages | undefined = tree;
  for (const part of key.split(".")) {
    if (typeof node !== "object" || node === null) return undefined;
    node = node[part];
  }
  return typeof node === "string" ? node : undefined;
}

/**
 * Build a translator bound to a catalog slice and a locale. An optional
 * `shared` catalog (e.g. the `common` namespace) is consulted after the
 * primary namespace, so a single `t` resolves both widget-scoped keys
 * (`title`, `actions.delete`) and shared ones (`cancel`, `never`).
 *
 * Resolution order per key: primary[locale] → shared[locale] →
 * primary.en → shared.en → the raw key (never blank).
 */
export function makeTranslator(
  catalog: LocaleCatalog,
  locale: Locale,
  shared?: LocaleCatalog,
): Translator {
  return (key, values = {}) => {
    const pattern =
      lookup(catalog[locale], key) ??
      lookup(shared?.[locale], key) ??
      lookup(catalog.en, key) ??
      lookup(shared?.en, key) ??
      key;
    return formatMessage(pattern, values, locale);
  };
}

/**
 * Humanise a coded widget/auth-core error into a localised string,
 * reusing the shared `error.*` catalog keys (same convention as B7's
 * `describeError`). Falls back to the server-provided message, then to
 * a generic localised string, so an unmapped code still reads sensibly.
 */
export function humanizeError(
  errorCatalog: LocaleCatalog,
  locale: Locale,
  code: string | undefined,
  serverMessage?: string,
): string {
  const t = makeTranslator(errorCatalog, locale);
  if (code) {
    const mapped = lookup(errorCatalog[locale], code) ?? lookup(errorCatalog.en, code);
    if (mapped) return formatMessage(mapped, {}, locale);
  }
  if (serverMessage) return serverMessage;
  return t("unknown");
}
