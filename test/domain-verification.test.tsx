import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthioDomainVerificationWidget } from "../src/domain-verification";
import { jsonResponse, makeFetchMock } from "./_helpers";

const fetchMock = makeFetchMock();
beforeEach(() => fetchMock.install());
afterEach(() => fetchMock.uninstall());

const RECORD = {
  type: "TXT",
  host_prefix: "_authio-challenge",
  value: "authio-domain-verification=abc123",
};

const DOMAINS = [
  {
    id: "dom_1",
    organization_id: "org_abc",
    domain: "acme.com",
    verified: true,
    created_at: "2026-05-01T00:00:00Z",
  },
];

const BASE_PROPS = { token: "t.t.t", organizationId: "org_abc" };

describe("<AuthioDomainVerificationWidget />", () => {
  it("mounts and lists verified domains with TXT challenge", async () => {
    fetchMock.on("/widget/domains", () =>
      jsonResponse(200, { data: DOMAINS, record: RECORD }),
    );
    const onEvent = vi.fn();
    render(
      <AuthioDomainVerificationWidget {...BASE_PROPS} onDomainUpdate={onEvent} />,
    );
    await waitFor(() => expect(screen.getByText("acme.com")).toBeInTheDocument());
    expect(screen.getByText(RECORD.value)).toBeInTheDocument();
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "loaded" }),
    );
  });

  it("renders empty state when no domains exist", async () => {
    fetchMock.on("/widget/domains", () =>
      jsonResponse(200, { data: [], record: RECORD }),
    );
    render(<AuthioDomainVerificationWidget {...BASE_PROPS} />);
    await waitFor(() =>
      expect(screen.getByText(/No domains verified yet/i)).toBeInTheDocument(),
    );
  });

  it("fires verified event when DNS check succeeds", async () => {
    fetchMock.on("/widget/domains", (init) => {
      if (init?.method === "POST") {
        return jsonResponse(200, {
          verified: true,
          domain: {
            id: "dom_new",
            organization_id: "org_abc",
            domain: "new.co",
            verified: true,
            created_at: "2026-07-09T00:00:00Z",
          },
          record: RECORD,
        });
      }
      return jsonResponse(200, { data: [], record: RECORD });
    });
    const onEvent = vi.fn();
    render(
      <AuthioDomainVerificationWidget {...BASE_PROPS} onDomainUpdate={onEvent} />,
    );
    await waitFor(() =>
      expect(screen.getByPlaceholderText("acme.com")).toBeInTheDocument(),
    );
    fireEvent.change(screen.getByPlaceholderText("acme.com"), {
      target: { value: "new.co" },
    });
    fireEvent.click(screen.getByText("Check now"));
    await waitFor(() =>
      expect(onEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: "verified" }),
      ),
    );
  });

  it("shows pending message when TXT is missing", async () => {
    fetchMock.on("/widget/domains", (init) => {
      if (init?.method === "POST") {
        return jsonResponse(200, {
          verified: false,
          domain: "pending.co",
          record: RECORD,
          message: "TXT record not found yet. DNS can take a few minutes to propagate.",
        });
      }
      return jsonResponse(200, { data: [], record: RECORD });
    });
    render(<AuthioDomainVerificationWidget {...BASE_PROPS} />);
    await waitFor(() =>
      expect(screen.getByPlaceholderText("acme.com")).toBeInTheDocument(),
    );
    fireEvent.change(screen.getByPlaceholderText("acme.com"), {
      target: { value: "pending.co" },
    });
    fireEvent.click(screen.getByText("Check now"));
    await waitFor(() =>
      expect(screen.getByText(/TXT record not found yet/i)).toBeInTheDocument(),
    );
  });
});
