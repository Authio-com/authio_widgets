import { render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AuthioSSOConnectionWidget,
  mountSSOConnectionWidget,
} from "../src/sso-connection";
import {
  errorResponse,
  jsonResponse,
  makeFetchMock,
  textResponse,
} from "./_helpers";

const fetchMock = makeFetchMock();

beforeEach(() => fetchMock.install());
afterEach(() => fetchMock.uninstall());

describe("<AuthioSSOConnectionWidget />", () => {
  it("loads + lists existing connections", async () => {
    fetchMock.on("/widget/sso-connections", () =>
      jsonResponse(200, {
        data: [
          {
            id: "conn_1",
            organization_id: "org_abc",
            provider: "okta",
            protocol: "saml",
            status: "active",
            created_at: "2026-05-01T00:00:00Z",
            configured_at: "2026-05-02T00:00:00Z",
          },
        ],
      }),
    );
    const onUpdate = vi.fn();
    render(
      <AuthioSSOConnectionWidget
        token="t.t.t"
        organizationId="org_abc"
        onConnectionUpdate={onUpdate}
      />,
    );
    await waitFor(() => expect(screen.getByText("Okta")).toBeInTheDocument());
    expect(screen.getByText("active")).toBeInTheDocument();
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ type: "loaded" }),
    );
  });

  it("renders the empty state when no connections exist", async () => {
    fetchMock.on("/widget/sso-connections", () =>
      jsonResponse(200, { data: [] }),
    );
    render(
      <AuthioSSOConnectionWidget token="t.t.t" organizationId="org_abc" />,
    );
    await waitFor(() =>
      expect(screen.getByText(/No SSO connections yet/i)).toBeInTheDocument(),
    );
  });

  it("surfaces a 403 widget_origin_mismatch as an inline error", async () => {
    fetchMock.on("/widget/sso-connections", () =>
      errorResponse(
        403,
        "widget_origin_mismatch",
        "origin not in widget_origins[]",
      ),
    );
    const onUpdate = vi.fn();
    render(
      <AuthioSSOConnectionWidget
        token="t.t.t"
        organizationId="org_abc"
        onConnectionUpdate={onUpdate}
      />,
    );
    // C7: coded errors are localised from the shared `error.*` catalog
    // (keyed on the stable code, never on the server's English string).
    // The raw code is still surfaced in the muted suffix for support.
    await waitFor(() =>
      expect(
        screen.getByText(/authorized to run on this site/i),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText(/\(widget_origin_mismatch\)/)).toBeInTheDocument();
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ type: "error" }),
    );
  });

  it("creates a connection from the form", async () => {
    let listCallCount = 0;
    fetchMock.on("/widget/sso-connections", (init) => {
      if (init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as Record<string, unknown>;
        return jsonResponse(201, {
          id: "conn_new",
          organization_id: "org_abc",
          provider: body.provider,
          protocol: body.protocol,
          status: "pending",
          created_at: "2026-05-23T00:00:00Z",
        });
      }
      listCallCount++;
      return jsonResponse(200, { data: [] });
    });
    const onUpdate = vi.fn();
    const { container } = render(
      <AuthioSSOConnectionWidget
        token="t.t.t"
        organizationId="org_abc"
        onConnectionUpdate={onUpdate}
      />,
    );
    // Initial load.
    await waitFor(() =>
      expect(screen.getByText(/No SSO connections yet/i)).toBeInTheDocument(),
    );
    expect(listCallCount).toBeGreaterThan(0);
    // Click "New connection".
    screen.getByRole("button", { name: /new connection/i }).click();
    // Submit form (Okta SAML is the default + we leave the metadata
    // textarea empty — the API allows empty metadata for the
    // "fill in later" flow).
    const submit = await screen.findByRole("button", {
      name: /create connection/i,
    });
    submit.click();
    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ type: "created" }),
      ),
    );
    // Verify the new row is rendered.
    expect(within(container).getByText(/Okta/)).toBeInTheDocument();
  });

  it("downloads SP metadata as a blob URL and revokes it on unmount", async () => {
    fetchMock.on("/widget/sso-connections/conn_1/metadata", () =>
      textResponse(200, "<EntityDescriptor/>"),
    );
    fetchMock.on("/widget/sso-connections", () =>
      jsonResponse(200, {
        data: [
          {
            id: "conn_1",
            organization_id: "org_abc",
            provider: "okta",
            protocol: "saml",
            status: "active",
            created_at: "2026-05-01T00:00:00Z",
            configured_at: "2026-05-02T00:00:00Z",
          },
        ],
      }),
    );

    const revokeSpy = vi.spyOn(URL, "revokeObjectURL");

    const { unmount } = render(
      <AuthioSSOConnectionWidget token="t.t.t" organizationId="org_abc" />,
    );
    await waitFor(() => expect(screen.getByText("Okta")).toBeInTheDocument());
    screen.getByRole("button", { name: /metadata/i }).click();
    await waitFor(() =>
      expect(screen.getByRole("link", { name: /download xml/i })).toBeInTheDocument(),
    );
    unmount();
    expect(revokeSpy).toHaveBeenCalled();
  });
});

describe("mountSSOConnectionWidget", () => {
  it("mounts + unmounts via the imperative API", async () => {
    fetchMock.on("/widget/sso-connections", () =>
      jsonResponse(200, { data: [] }),
    );
    const el = document.createElement("div");
    document.body.appendChild(el);
    const handle = mountSSOConnectionWidget(el, {
      token: "t.t.t",
      organizationId: "org_abc",
    });
    await waitFor(() =>
      expect(el.textContent).toMatch(/No SSO connections yet/i),
    );
    handle.unmount();
    expect(el.textContent).toBe("");
    el.remove();
  });

  it("re-renders when update() is called with new props", async () => {
    fetchMock.on("/widget/sso-connections", () =>
      jsonResponse(200, { data: [] }),
    );
    const el = document.createElement("div");
    document.body.appendChild(el);
    const handle = mountSSOConnectionWidget(el, {
      token: "t.t.t",
      organizationId: "org_a",
    });
    await waitFor(() =>
      expect(el.textContent).toMatch(/No SSO connections yet/i),
    );
    handle.update({ token: "t.t.t", organizationId: "org_b" });
    // Just ensure the call doesn't throw + DOM stays mounted.
    expect(el.textContent).toMatch(/No SSO connections yet/i);
    handle.unmount();
    el.remove();
  });
});
