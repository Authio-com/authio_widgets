import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AuthioSSOConnectionWidget } from "../src/sso-connection";
import { AuthioDirectorySyncWidget } from "../src/directory-sync";
import { jsonResponse, makeFetchMock } from "./_helpers";

const fetchMock = makeFetchMock();
beforeEach(() => fetchMock.install());
afterEach(() => fetchMock.uninstall());

describe("widget locale prop (C7)", () => {
  it("renders the SSO widget fully in German when locale=\"de\"", async () => {
    fetchMock.on("/widget/sso-connections", () => jsonResponse(200, { data: [] }));
    render(
      <AuthioSSOConnectionWidget token="t.t.t" organizationId="org_abc" locale="de" />,
    );
    await waitFor(() =>
      expect(screen.getByText("SSO-Verbindungen")).toBeInTheDocument(),
    );
    expect(
      screen.getByRole("button", { name: "Neue Verbindung" }),
    ).toBeInTheDocument();
    // The ICU interpolation in the empty state resolves the localised
    // action label, not the English one.
    expect(screen.getByText(/Noch keine SSO-Verbindungen/)).toBeInTheDocument();
  });

  it("normalises a region subtag (de-DE → de) inside the widget", async () => {
    fetchMock.on("/widget/sso-connections", () => jsonResponse(200, { data: [] }));
    render(
      <AuthioSSOConnectionWidget token="t.t.t" organizationId="org_abc" locale="de-DE" />,
    );
    await waitFor(() =>
      expect(screen.getByText("SSO-Verbindungen")).toBeInTheDocument(),
    );
  });

  it("falls back to English for an unsupported locale", async () => {
    fetchMock.on("/widget/sso-connections", () => jsonResponse(200, { data: [] }));
    render(
      <AuthioSSOConnectionWidget token="t.t.t" organizationId="org_abc" locale="zz" />,
    );
    await waitFor(() =>
      expect(screen.getByText("SSO connections")).toBeInTheDocument(),
    );
  });

  it("keeps default (no locale prop) behaviour as English", async () => {
    fetchMock.on("/widget/sso-connections", () => jsonResponse(200, { data: [] }));
    render(<AuthioSSOConnectionWidget token="t.t.t" organizationId="org_abc" />);
    await waitFor(() =>
      expect(screen.getByText("SSO connections")).toBeInTheDocument(),
    );
  });

  it("localises a second widget independently (directory sync in Japanese)", async () => {
    fetchMock.on("/widget/directories", () => jsonResponse(200, { data: [] }));
    render(
      <AuthioDirectorySyncWidget token="t.t.t" organizationId="org_abc" locale="ja" />,
    );
    await waitFor(() =>
      expect(screen.getByText("ディレクトリ同期")).toBeInTheDocument(),
    );
  });
});
