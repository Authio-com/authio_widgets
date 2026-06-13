import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthioAuditLogWidget } from "../src/audit-log";
import { errorResponse, jsonResponse, makeFetchMock } from "./_helpers";

const fetchMock = makeFetchMock();
beforeEach(() => fetchMock.install());
afterEach(() => fetchMock.uninstall());

const EVENTS = [
  {
    id: "evt_1",
    action: "session.created",
    actor_type: "user",
    actor_id: "user_abc",
    target_type: "session",
    target_id: "sess_xyz",
    ip: "1.2.3.4",
    created_at: "2026-05-24T10:00:00Z",
  },
  {
    id: "evt_2",
    action: "api_key.created",
    actor_type: "widget",
    actor_id: null,
    target_type: "api_key",
    target_id: "ak_def",
    ip: null,
    created_at: "2026-05-24T09:00:00Z",
  },
];

const BASE_PROPS = { token: "t.t.t", organizationId: "org_abc" };

describe("<AuthioAuditLogWidget />", () => {
  it("mounts and renders the event list", async () => {
    fetchMock.on("/widget/audit-events", () =>
      jsonResponse(200, { data: EVENTS, total: 2 }),
    );
    render(<AuthioAuditLogWidget {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByText("session.created")).toBeInTheDocument());
    expect(screen.getByText("api_key.created")).toBeInTheDocument();
  });

  it("renders the empty state when no events exist", async () => {
    fetchMock.on("/widget/audit-events", () =>
      jsonResponse(200, { data: [], total: 0 }),
    );
    render(<AuthioAuditLogWidget {...BASE_PROPS} />);
    await waitFor(() =>
      expect(screen.getByText(/No audit events found/i)).toBeInTheDocument(),
    );
  });

  it("expands row metadata on click", async () => {
    fetchMock.on("/widget/audit-events", () =>
      jsonResponse(200, { data: EVENTS, total: 2 }),
    );
    render(<AuthioAuditLogWidget {...BASE_PROPS} />);
    // Wait for events to load
    const pill = await waitFor(() => screen.getByText("session.created"));
    // Click the row that contains the action pill
    fireEvent.click(pill.closest("tr")!);
    // The expanded row shows JSON with target_id
    await waitFor(() => {
      const pre = document.querySelector("pre");
      expect(pre).not.toBeNull();
      expect(pre!.textContent).toContain("sess_xyz");
    });
  });

  it("surfaces a 403 widget_scope_required error inline", async () => {
    fetchMock.on("/widget/audit-events", () =>
      errorResponse(403, "widget_scope_required", "audit_log.read scope required"),
    );
    render(<AuthioAuditLogWidget {...BASE_PROPS} />);
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("widget_scope_required"),
    );
  });

  it("shows loading spinner initially", () => {
    // Never resolves — keeps the loading state.
    fetchMock.on("/widget/audit-events", () => new Promise(() => {}));
    render(<AuthioAuditLogWidget {...BASE_PROPS} />);
    expect(screen.getByText(/Loading events/i)).toBeInTheDocument();
  });

  it("shows pagination controls when total > page size", async () => {
    fetchMock.on("/widget/audit-events", () =>
      jsonResponse(200, { data: EVENTS, total: 200 }),
    );
    render(<AuthioAuditLogWidget {...BASE_PROPS} pageSize={50} />);
    await waitFor(() => expect(screen.getByText("Next")).toBeInTheDocument());
    expect(screen.getByText("Previous")).toBeInTheDocument();
  });

  it("Export CSV button is rendered and clickable", async () => {
    fetchMock.on("/widget/audit-events", () =>
      jsonResponse(200, { data: EVENTS, total: 2 }),
    );
    render(<AuthioAuditLogWidget {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByText("Export CSV")).toBeInTheDocument());
  });
});
