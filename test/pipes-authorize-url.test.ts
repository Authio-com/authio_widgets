import { describe, expect, it } from "vitest";
import { safeAuthorizationUrl } from "../src/pipes";

describe("safeAuthorizationUrl", () => {
  it("allows https provider authorize URLs", () => {
    expect(safeAuthorizationUrl("https://accounts.google.com/o/oauth2/v2/auth?client_id=x")).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth?client_id=x",
    );
  });

  it("allows http only for localhost", () => {
    expect(safeAuthorizationUrl("http://localhost:4000/authorize")).toBe("http://localhost:4000/authorize");
    expect(safeAuthorizationUrl("http://example.com/authorize")).toBeNull();
  });

  it("rejects script-bearing and malformed URLs (XSS)", () => {
    for (const bad of [
      "javascript:alert(document.cookie)",
      " JaVaScRiPt:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:msgbox(1)",
      "/relative/path",
      "",
      null,
      undefined,
      42,
    ]) {
      expect(safeAuthorizationUrl(bad as unknown), String(bad)).toBeNull();
    }
  });
});
