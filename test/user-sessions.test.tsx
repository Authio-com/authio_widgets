import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthioUserSessionsWidget } from "../src/user-sessions";
import { errorResponse, jsonResponse, makeFetchMock } from "./_helpers";

const fetchMock = makeFetchMock();
beforeEach(() => fetchMock.install());
afterEach(() => fetchMock.uninstall());

const SESSIONS = [
  {
    id: "sess_1",
    user_id: "user_abc",
    device: "MacBook Pro",
    browser: "Safari 17.4",
    ip: "192.0.2.1",
    location: "New York, US",
    last_active_at: "2026-05-24T10:00:00Z",
    expires_at: "2026-06-23T10:00:00Z",
    issued_at: "2026-05-24T09:00:00Z",
    active_organization_id: "org_abc",
  },
  {
    id: "sess_2",
    user_id: "user_abc",
    device: null,
    browser: "Chrome 125",
    ip: "203.0.113.5",
    location: null,
    last_active_at: "2026-05-23T15:00:00Z",
    expires_at: "2026-06-22T15:00:00Z",
    issued_at: "2026-05-23T14:00:00Z",
    active_organization_id: null,
  },
];

const BASE_PROPS = { token: "t.t.t", organizationId: "org_abc" };

describe("<AuthioUserSessionsWidget />", () => {
  it("mounts and lists active sessions", async () => {
    fetchMock.on("/widget/sessions", () => jsonResponse(200, { data: SESSIONS }));
    const onRevoked = vi.fn();
    render(<AuthioUserSessionsWidget {...BASE_PROPS} onSessionRevoked={onRevoked} />);
    await waitFor(() => expect(screen.getByText("Safari 17.4")).toBeInTheDocument());
    expect(screen.getByText("Chrome 125")).toBeInTheDocument();
    expect(onRevoked).toHaveBeenCalledWith(expect.objectContaining({ type: "loaded" }));
  });

  it("renders empty state when no sessions", async () => {
    fetchMock.on("/widget/sessions", () => jsonResponse(200, { data: [] }));
    render(<AuthioUserSessionsWidget {...BASE_PROPS} />);
    await waitFor(() =>
      expect(screen.getByText(/No active sessions found/i)).toBeInTheDocument(),
    );
  });

  it("shows loading spinner initially", () => {
    fetchMock.on("/widget/sessions", () => new Promise(() => {}));
    render(<AuthioUserSessionsWidget {...BASE_PROPS} />);
    expect(screen.getByText(/Loading sessions/i)).toBeInTheDocument();
  });

  it("surfaces 403 widget_user_id_required error inline", async () => {
    fetchMock.on("/widget/sessions", () =>
      errorResponse(403, "widget_user_id_required", "sessions.read requires widget_user_id"),
    );
    render(<AuthioUserSessionsWidget {...BASE_PROPS} />);
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("widget_user_id_required"),
    );
  });

  it("shows 'Revoke all sessions' when sessions exist", async () => {
    fetchMock.on("/widget/sessions", () => jsonResponse(200, { data: SESSIONS }));
    render(<AuthioUserSessionsWidget {...BASE_PROPS} />);
    await waitFor(() =>
      expect(screen.getByText("Revoke all sessions")).toBeInTheDocument(),
    );
  });

  it("shows per-session Revoke button for each session", async () => {
    fetchMock.on("/widget/sessions", () => jsonResponse(200, { data: SESSIONS }));
    render(<AuthioUserSessionsWidget {...BASE_PROPS} />);
    await waitFor(() =>
      expect(screen.getAllByText("Revoke")).toHaveLength(SESSIONS.length),
    );
  });

  it("displays IP and location from session data", async () => {
    fetchMock.on("/widget/sessions", () => jsonResponse(200, { data: SESSIONS }));
    render(<AuthioUserSessionsWidget {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByText("192.0.2.1")).toBeInTheDocument());
    expect(screen.getByText("New York, US")).toBeInTheDocument();
  });
});
