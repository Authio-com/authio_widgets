import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthioOrganizationSwitcherWidget } from "../src/organization-switcher";
import { errorResponse, jsonResponse, makeFetchMock } from "./_helpers";

const fetchMock = makeFetchMock();
beforeEach(() => fetchMock.install());
afterEach(() => fetchMock.uninstall());

const ORGS = [
  {
    id: "org_abc",
    name: "Acme Corp",
    slug: "acme",
    role: "admin",
    status: "active",
    joined_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "org_def",
    name: "Beta Labs",
    slug: "beta-labs",
    role: "member",
    status: "active",
    joined_at: "2026-03-15T00:00:00Z",
  },
];

const BASE_PROPS = {
  token: "t.t.t",
  organizationId: "org_abc",
  onOrgSwitch: vi.fn(),
};

describe("<AuthioOrganizationSwitcherWidget />", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a trigger button with the current org name", async () => {
    fetchMock.on("/widget/organizations", () =>
      jsonResponse(200, { data: ORGS }),
    );
    render(<AuthioOrganizationSwitcherWidget {...BASE_PROPS} currentOrgId="org_abc" />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Acme Corp/i })).toBeInTheDocument(),
    );
  });

  it("opens the dropdown on button click", async () => {
    fetchMock.on("/widget/organizations", () =>
      jsonResponse(200, { data: ORGS }),
    );
    render(<AuthioOrganizationSwitcherWidget {...BASE_PROPS} currentOrgId="org_abc" />);
    // Wait for orgs to load (button shows org name when loaded).
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Acme Corp/i })).not.toBeDisabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: /Acme Corp/i }));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    // Both org names appear in the dropdown items
    expect(screen.getAllByText("Acme Corp").length).toBeGreaterThan(0);
    expect(screen.getByText("Beta Labs")).toBeInTheDocument();
  });

  it("calls onOrgSwitch when an org is selected", async () => {
    const onOrgSwitch = vi.fn();
    fetchMock.on("/widget/organizations", () =>
      jsonResponse(200, { data: ORGS }),
    );
    render(
      <AuthioOrganizationSwitcherWidget
        {...BASE_PROPS}
        onOrgSwitch={onOrgSwitch}
        currentOrgId="org_abc"
      />,
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Acme Corp/i })).not.toBeDisabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: /Acme Corp/i }));
    await waitFor(() => expect(screen.getByText("Beta Labs")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("option", { name: /Beta Labs/i }));
    expect(onOrgSwitch).toHaveBeenCalledWith("org_def", expect.objectContaining({ id: "org_def" }));
  });

  it("shows Add organization CTA when onAddOrganization is provided", async () => {
    fetchMock.on("/widget/organizations", () =>
      jsonResponse(200, { data: ORGS }),
    );
    const onAdd = vi.fn();
    render(
      <AuthioOrganizationSwitcherWidget
        {...BASE_PROPS}
        onAddOrganization={onAdd}
        currentOrgId="org_abc"
      />,
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Acme Corp/i })).not.toBeDisabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: /Acme Corp/i }));
    await waitFor(() =>
      expect(screen.getByText(/Add organization/i)).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByText(/Add organization/i));
    expect(onAdd).toHaveBeenCalledOnce();
  });

  it("renders empty state when user has no orgs", async () => {
    fetchMock.on("/widget/organizations", () =>
      jsonResponse(200, { data: [] }),
    );
    render(<AuthioOrganizationSwitcherWidget {...BASE_PROPS} />);
    // With no orgs, text is "Select organization"
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Select organization/i })).not.toBeDisabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: /Select organization/i }));
    await waitFor(() =>
      expect(screen.getByText(/No organizations found/i)).toBeInTheDocument(),
    );
  });

  it("surfaces a 403 error inline", async () => {
    fetchMock.on("/widget/organizations", () =>
      errorResponse(403, "widget_user_id_required", "organizations.read requires widget_user_id"),
    );
    render(<AuthioOrganizationSwitcherWidget {...BASE_PROPS} />);
    await waitFor(() =>
      expect(screen.getByRole("alert")).toBeInTheDocument(),
    );
    expect(screen.getByRole("alert")).toHaveTextContent("widget_user_id_required");
  });
});
