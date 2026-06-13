import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOCALE,
  isSupportedLocale,
  localeFromBrowser,
  normalizeLocale,
  resolveWidgetLocale,
  SUPPORTED_LOCALES,
} from "../src/i18n/locale";

describe("locale normalisation", () => {
  it("folds case and region subtags onto supported locales", () => {
    expect(normalizeLocale("de")).toBe("de");
    expect(normalizeLocale("DE")).toBe("de");
    expect(normalizeLocale("de-DE")).toBe("de");
    expect(normalizeLocale("pt")).toBe("pt-BR");
    expect(normalizeLocale("pt-PT")).toBe("pt-BR");
    expect(normalizeLocale("pt-br")).toBe("pt-BR");
    expect(normalizeLocale("EN-US")).toBe("en");
  });

  it("returns null for unknown / empty input", () => {
    expect(normalizeLocale("xx")).toBeNull();
    expect(normalizeLocale("")).toBeNull();
    expect(normalizeLocale(null)).toBeNull();
    expect(normalizeLocale(undefined)).toBeNull();
  });

  it("isSupportedLocale guards the supported set", () => {
    for (const l of SUPPORTED_LOCALES) expect(isSupportedLocale(l)).toBe(true);
    expect(isSupportedLocale("de-DE")).toBe(false);
    expect(isSupportedLocale(42)).toBe(false);
  });
});

describe("localeFromBrowser", () => {
  it("picks the first supported tag from navigator.languages", () => {
    expect(
      localeFromBrowser({ languages: ["zh-CN", "fr-FR", "en"], language: "zh-CN" }),
    ).toBe("fr");
  });

  it("falls back to navigator.language when languages is empty", () => {
    expect(localeFromBrowser({ languages: [], language: "ja" })).toBe("ja");
  });

  it("returns null when nothing matches", () => {
    expect(localeFromBrowser({ languages: ["zh", "ko"], language: "zh" })).toBeNull();
    expect(localeFromBrowser({})).toBeNull();
  });
});

describe("resolveWidgetLocale — precedence chain", () => {
  it("prefers the explicit prop", () => {
    expect(resolveWidgetLocale("de", { language: "fr", languages: ["fr"] })).toBe("de");
  });

  it("falls back to the browser when no/invalid explicit locale", () => {
    expect(resolveWidgetLocale(undefined, { language: "fr", languages: ["fr"] })).toBe("fr");
    expect(resolveWidgetLocale("xx", { language: "es", languages: ["es"] })).toBe("es");
  });

  it("falls back to en when neither yields a supported locale", () => {
    expect(resolveWidgetLocale(null, { language: "zh", languages: ["zh"] })).toBe(
      DEFAULT_LOCALE,
    );
    expect(DEFAULT_LOCALE).toBe("en");
  });
});
