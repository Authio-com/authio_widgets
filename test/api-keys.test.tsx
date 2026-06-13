import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthioAPIKeysWidget } from "../src/api-keys";
import { errorResponse, jsonResponse, makeFetchMock } from "./_helpers";

const fetchMock = makeFetchMock();
beforeEach(() => fetchMock.install());
afterEach(() => fetchMock.uninstall());

const KEYS = [
  {
    id: "ak_1",
    name: "Production",
    prefix: "sk_live_a1b2",
    scopes: ["read", "write"],
    created_at: "2026-05-01T00:00:00Z",
    last_used_at: "2026-05-24T08:00:00Z",
  },
  {
    id: "ak_2",
    name: "Staging",
    prefix: "sk_live_c3d4",
    scopes: [],
    created_at: "2026-05-10T00:00:00Z",
    last_used_at: null,
  },
];

const BASE_PROPS = { token: "t.t.t", organizationId: "org_abc" };

describe("<AuthioAPIKeysWidget />", () => {
  it("mounts and lists existing API keys", async () => {
    fetchMock.on("/widget/api-keys", () => jsonResponse(200, { data: KEYS }));
    const onEvent = vi.fn();
    render(<AuthioAPIKeysWidget {...BASE_PROPS} onKeyCreated={onEvent} />);
    await waitFor(() => expect(screen.getByText("Production")).toBeInTheDocument());
    expect(screen.getByText("Staging")).toBeInTheDocument();
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "loaded" }));
  });

  it("renders the empty state when no keys exist", async () => {
    fetchMock.on("/widget/api-keys", () => jsonResponse(200, { data: [] }));
    render(<AuthioAPIKeysWidget {...BASE_PROPS} />);
    await waitFor(() =>
      expect(screen.getByText(/No API keys yet/i)).toBeInTheDocument(),
    );
  });

  it("shows 'Create key' button", async () => {
    fetchMock.on("/widget/api-keys", () => jsonResponse(200, { data: [] }));
    render(<AuthioAPIKeysWidget {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByText("Create key")).toBeInTheDocument());
  });

  it("opens create form on button click", async () => {
    fetchMock.on("/widget/api-keys", () => jsonResponse(200, { data: [] }));
    render(<AuthioAPIKeysWidget {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByText("Create key")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Create key"));
    expect(screen.getByPlaceholderText("Production key")).toBeInTheDocument();
  });

  it("fires onKeyCreated with created + rawKey on successful create", async () => {
    let callCount = 0;
    fetchMock.on("/widget/api-keys", (init) => {
      // First call (GET) returns empty; second call (POST) returns created key.
      if (init?.method === "POST") {
        return jsonResponse(201, {
          api_key: {
            id: "ak_new",
            name: "My new key",
            prefix: "sk_live_ab12",
            scopes: [],
            created_at: "2026-05-24T10:00:00Z",
          },
          key: "sk_live_newkey1234", // gitleaks:allow — synthetic test fixture, not a live key
          warning: "Store this key now.",
        });
      }
      return jsonResponse(200, { data: [] });
    });
    const onEvent = vi.fn();
    render(<AuthioAPIKeysWidget {...BASE_PROPS} onKeyCreated={onEvent} />);
    await waitFor(() => expect(screen.getByText("Create key")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Create key"));
    const nameInput = screen.getByPlaceholderText("Production key");
    fireEvent.change(nameInput, { target: { value: "My new key" } });
    const form = nameInput.closest("form")!;
    fireEvent.submit(form);
    await waitFor(() =>
      expect(onEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: "created" }),
      ),
    );
    void callCount; // suppress unused warning
  });

  it("surfaces a 403 error inline", async () => {
    fetchMock.on("/widget/api-keys", () =>
      errorResponse(403, "widget_scope_required", "api_keys.manage scope required"),
    );
    render(<AuthioAPIKeysWidget {...BASE_PROPS} />);
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("widget_scope_required"),
    );
  });

  it("revoke button is present for each key", async () => {
    fetchMock.on("/widget/api-keys", () => jsonResponse(200, { data: KEYS }));
    render(<AuthioAPIKeysWidget {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getAllByText("Revoke")).toHaveLength(KEYS.length));
  });
});
