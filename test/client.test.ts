import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WidgetClient } from "../src/client";
import { WidgetError } from "../src/errors";
import { errorResponse, jsonResponse, makeFetchMock } from "./_helpers";

describe("WidgetClient", () => {
  const fetchMock = makeFetchMock();
  beforeEach(() => fetchMock.install());
  afterEach(() => fetchMock.uninstall());

  it("requires a token + organizationId", () => {
    expect(
      () =>
        new WidgetClient({
          token: "",
          organizationId: "org_abc",
        }),
    ).toThrow(WidgetError);
    expect(
      () =>
        new WidgetClient({
          token: "tok",
          organizationId: "",
        }),
    ).toThrow(WidgetError);
  });

  it("attaches Authorization + X-Authio-Organization headers", async () => {
    fetchMock.on("/widget/sso-connections", (init) => {
      const headers = new Headers(init?.headers ?? {});
      expect(headers.get("authorization")).toBe("Bearer t.t.t");
      expect(headers.get("x-authio-organization")).toBe("org_abc");
      return jsonResponse(200, { data: [] });
    });
    const client = new WidgetClient({
      token: "t.t.t",
      organizationId: "org_abc",
      apiUrl: "https://api.example.test",
    });
    await client.fetch("/widget/sso-connections");
    expect(fetchMock.mock).toHaveBeenCalledOnce();
  });

  it("surfaces server-side errors as a typed WidgetError", async () => {
    fetchMock.on("/widget/sso-connections", () =>
      errorResponse(403, "widget_origin_mismatch", "origin not allowed"),
    );
    const client = new WidgetClient({
      token: "t.t.t",
      organizationId: "org_abc",
    });
    let caught: unknown;
    try {
      await client.fetch("/widget/sso-connections");
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(WidgetError);
    expect((caught as WidgetError).code).toBe("widget_origin_mismatch");
    expect((caught as WidgetError).status).toBe(403);
  });

  it("supports text response mode for SP-metadata XML", async () => {
    fetchMock.on("/widget/sso-connections/conn_1/metadata", () =>
      new Response("<EntityDescriptor/>", {
        status: 200,
        headers: { "content-type": "application/xml" },
      }),
    );
    const client = new WidgetClient({
      token: "t.t.t",
      organizationId: "org_abc",
    });
    const xml = await client.fetch<string>(
      "/widget/sso-connections/conn_1/metadata",
      { expect: "text" },
    );
    expect(xml).toBe("<EntityDescriptor/>");
  });

  it("wraps network errors with code=network_error", async () => {
    fetchMock.on("/widget/sso-connections", async () => {
      throw new TypeError("Failed to fetch");
    });
    const client = new WidgetClient({
      token: "t.t.t",
      organizationId: "org_abc",
    });
    let caught: unknown;
    try {
      await client.fetch("/widget/sso-connections");
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(WidgetError);
    expect((caught as WidgetError).code).toBe("network_error");
  });
});
