import { describe, expect, it } from "vitest";
import en from "../messages/en.json";
import de from "../messages/de.json";
import fr from "../messages/fr.json";
import es from "../messages/es.json";
import ja from "../messages/ja.json";
import ptBR from "../messages/pt-BR.json";

const LOCALES = { de, fr, es, ja, "pt-BR": ptBR } as const;

function flat(obj: unknown, prefix = ""): string[] {
  if (typeof obj !== "object" || obj === null) return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    typeof v === "object" && v !== null
      ? flat(v, `${prefix}${k}.`)
      : [`${prefix}${k}`],
  );
}

describe("message catalog key parity", () => {
  const enKeys = flat(en).sort();

  for (const [locale, catalog] of Object.entries(LOCALES)) {
    it(`${locale}.json has exactly the same keys as en.json`, () => {
      const keys = flat(catalog).sort();
      const missing = enKeys.filter((k) => !keys.includes(k));
      const extra = keys.filter((k) => !enKeys.includes(k));
      expect({ locale, missing, extra }).toEqual({ locale, missing: [], extra: [] });
    });
  }

  it("every value is a non-empty string", () => {
    for (const [locale, catalog] of [["en", en], ...Object.entries(LOCALES)] as const) {
      const empties = flat(catalog).filter((k) => {
        const v = k
          .split(".")
          .reduce<unknown>((acc, p) => (acc as Record<string, unknown>)?.[p], catalog);
        return typeof v !== "string" || v.trim() === "";
      });
      expect({ locale, empties }).toEqual({ locale, empties: [] });
    }
  });

  it("ICU placeholders are consistent across locales (no dropped {vars})", () => {
    // Match only ICU *argument* names — `{name}` or `{name, plural,…}` —
    // not the `{…}` branch bodies of a plural/select (whose copy is
    // expected to differ per language).
    const vars = (s: string) =>
      [...new Set([...s.matchAll(/\{(\w+)\s*[,}]/g)].map((m) => m[1]))].sort();
    const get = (cat: unknown, key: string) =>
      key.split(".").reduce<unknown>((a, p) => (a as Record<string, unknown>)?.[p], cat) as string;
    for (const key of enKeys) {
      const enVars = vars(get(en, key));
      for (const [locale, catalog] of Object.entries(LOCALES)) {
        expect({ key, locale, vars: vars(get(catalog, key)) }).toEqual({
          key,
          locale,
          vars: enVars,
        });
      }
    }
  });
});
