import { describe, expect, it } from "vitest";
import { formatDate, formatMessage } from "../src/i18n/format";

describe("formatDate — widget locale, not browser locale", () => {
  const when = new Date(Date.UTC(2026, 2, 5, 14, 30));

  it("follows the locale argument rather than the runtime default", () => {
    const en = formatDate(when, "en", "date");
    const de = formatDate(when, "de", "date");
    expect(en).toBe(new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(when));
    expect(de).toBe(new Intl.DateTimeFormat("de", { dateStyle: "medium" }).format(when));
    expect(en).not.toBe(de);
  });

  it("accepts ISO strings and includes the time by default", () => {
    const iso = when.toISOString();
    expect(formatDate(iso, "en")).toBe(
      new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(when),
    );
  });

  it("returns an empty string for missing or invalid input", () => {
    expect(formatDate(null, "en")).toBe("");
    expect(formatDate(undefined, "en")).toBe("");
    expect(formatDate("", "en")).toBe("");
    expect(formatDate("not a date", "en")).toBe("");
  });

  it("falls back to English for an unknown locale tag", () => {
    expect(formatDate(when, "x-not-a-locale!!", "date")).toBe(
      new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(when),
    );
  });
});

describe("formatMessage — ICU-lite", () => {
  it("passes plain strings through untouched", () => {
    expect(formatMessage("Active sessions", {}, "en")).toBe("Active sessions");
  });

  it("interpolates simple {name} placeholders", () => {
    expect(
      formatMessage("Delete the {provider} connection?", { provider: "Okta" }, "en"),
    ).toBe("Delete the Okta connection?");
  });

  it("renders an empty string for missing/null values rather than the token", () => {
    expect(formatMessage("Hello {name}", { name: null }, "en")).toBe("Hello ");
    expect(formatMessage("Hello {name}", {}, "en")).toBe("Hello ");
  });

  it("selects English plural categories and substitutes #", () => {
    const m = "{count, plural, =0 {none} one {# item} other {# items}}";
    expect(formatMessage(m, { count: 0 }, "en")).toBe("none");
    expect(formatMessage(m, { count: 1 }, "en")).toBe("1 item");
    expect(formatMessage(m, { count: 5 }, "en")).toBe("5 items");
  });

  it("applies CLDR plural rules per locale via Intl.PluralRules", () => {
    const en = "{n, plural, one {# user} other {# users}}";
    // French treats 0 and 1 as `one`.
    const fr = "{n, plural, one {# utilisateur} other {# utilisateurs}}";
    expect(formatMessage(fr, { n: 0 }, "fr")).toBe("0 utilisateur");
    expect(formatMessage(fr, { n: 2 }, "fr")).toBe("2 utilisateurs");
    // Japanese only ever hits `other`.
    const ja = "{n, plural, other {# 件}}";
    expect(formatMessage(ja, { n: 1 }, "ja")).toBe("1 件");
    expect(formatMessage(en, { n: 1 }, "en")).toBe("1 user");
  });

  it("supports select with an other fallback", () => {
    const m = "{kind, select, sso {SSO} scim {SCIM} other {unknown}}";
    expect(formatMessage(m, { kind: "sso" }, "en")).toBe("SSO");
    expect(formatMessage(m, { kind: "ldap" }, "en")).toBe("unknown");
  });

  it("handles multiple placeholders and a trailing plural together", () => {
    const m = "{from}–{to} of {total, plural, one {# event} other {# events}}";
    expect(formatMessage(m, { from: 1, to: 50, total: 120 }, "en")).toBe(
      "1–50 of 120 events",
    );
  });
});
