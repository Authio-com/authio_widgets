import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AuthioDirectorySyncWidget,
  mountDirectorySyncWidget,
} from "../src/directory-sync";
import { errorResponse, jsonResponse, makeFetchMock } from "./_helpers";

const fetchMock = makeFetchMock();
beforeEach(() => fetchMock.install());
afterEach(() => fetchMock.uninstall());

describe("<AuthioDirectorySyncWidget />", () => {
  it("loads + lists directories", async () => {
    fetchMock.on("/widget/directories", () =>
      jsonResponse(200, {
        data: [
          {
            id: "dir_1",
            organization_id: "org_abc",
            name: "Acme Okta",
            provider: "okta",
            state: "active",
            last_sync_at: "2026-05-22T10:00:00Z",
            created_at: "2026-05-01T00:00:00Z",
          },
        ],
      }),
    );
    const onUpdate = vi.fn();
    render(
      <AuthioDirectorySyncWidget
        token="t.t.t"
        organizationId="org_abc"
        onDirectoryUpdate={onUpdate}
      />,
    );
    await waitFor(() => expect(screen.getByText("Acme Okta")).toBeInTheDocument());
    expect(screen.getByText("Okta SCIM")).toBeInTheDocument();
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ type: "loaded" }),
    );
  });

  it("shows the empty state + provisions a directory", async () => {
    let dirsListed = false;
    fetchMock.on("/widget/directories", (init) => {
      if (init?.method === "POST") {
        return jsonResponse(201, {
          directory: {
            id: "dir_new",
            organization_id: "org_abc",
            name: "Test dir",
            provider: "okta",
            state: "active",
            created_at: "2026-05-23T00:00:00Z",
          },
          bearer_token: "scim_secret_xyz",
          scim_endpoint: "https://api.example.test/scim/v2/dir_new",
        });
      }
      dirsListed = true;
      return jsonResponse(200, { data: [] });
    });
    const onUpdate = vi.fn();
    render(
      <AuthioDirectorySyncWidget
        token="t.t.t"
        organizationId="org_abc"
        apiUrl="https://api.example.test"
        onDirectoryUpdate={onUpdate}
      />,
    );
    await waitFor(() =>
      expect(screen.getByText(/No directories yet/i)).toBeInTheDocument(),
    );
    expect(dirsListed).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /provision directory/i }));
    fireEvent.change(screen.getByPlaceholderText(/Acme HQ Okta/i), {
      target: { value: "Test dir" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^provision$/i }));
    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ type: "provisioned" }),
      ),
    );
    // Secret-reveal panel surfaces the bearer token + the endpoint.
    expect(screen.getByDisplayValue("scim_secret_xyz")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("https://api.example.test/scim/v2/dir_new"),
    ).toBeInTheDocument();
  });

  it("triggers sync-now and emits the event", async () => {
    fetchMock.on("/widget/directories/dir_1/sync-now", (init) => {
      expect(init?.method).toBe("POST");
      return jsonResponse(200, { ok: true });
    });
    fetchMock.on("/widget/directories", () =>
      jsonResponse(200, {
        data: [
          {
            id: "dir_1",
            organization_id: "org_abc",
            name: "Acme Okta",
            provider: "okta",
            state: "active",
            last_sync_at: null,
            created_at: "2026-05-01T00:00:00Z",
          },
        ],
      }),
    );
    const onUpdate = vi.fn();
    render(
      <AuthioDirectorySyncWidget
        token="t.t.t"
        organizationId="org_abc"
        onDirectoryUpdate={onUpdate}
      />,
    );
    await waitFor(() => expect(screen.getByText("Acme Okta")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /sync now/i }));
    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ type: "synced", directoryId: "dir_1" }),
      ),
    );
  });

  it("surfaces token-expired errors", async () => {
    fetchMock.on("/widget/directories", () =>
      errorResponse(401, "widget_token_expired", "JWT past exp"),
    );
    const onUpdate = vi.fn();
    render(
      <AuthioDirectorySyncWidget
        token="t.t.t"
        organizationId="org_abc"
        onDirectoryUpdate={onUpdate}
      />,
    );
    // C7: `widget_token_expired` resolves to the localised catalog
    // string; the code remains visible in the muted suffix.
    await waitFor(() =>
      expect(screen.getByText(/session expired/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(/\(widget_token_expired\)/)).toBeInTheDocument();
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ type: "error" }),
    );
  });
});

describe("mountDirectorySyncWidget", () => {
  it("mounts + unmounts cleanly", async () => {
    fetchMock.on("/widget/directories", () =>
      jsonResponse(200, { data: [] }),
    );
    const el = document.createElement("div");
    document.body.appendChild(el);
    const handle = mountDirectorySyncWidget(el, {
      token: "t.t.t",
      organizationId: "org_abc",
    });
    await waitFor(() =>
      expect(el.textContent).toMatch(/No directories yet/i),
    );
    handle.unmount();
    expect(el.textContent).toBe("");
    el.remove();
  });
});
