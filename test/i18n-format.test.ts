import { describe, expect, it } from "vitest";
import { formatMessage } from "../src/i18n/format";

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
