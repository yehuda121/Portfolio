import "../../i18n";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AdminShell from "./AdminShell";
import { adminListQuestions, getQuizAdminToken, setQuizAdminToken } from "../../api/quizApi";
import { apiFetch } from "../../api/client";

jest.mock("../../api/client", () => ({
  apiFetch: jest.fn(),
  isApiConfigured: () => true,
}));

describe("useAdminAuth 401 UI state", () => {
  beforeEach(() => {
    sessionStorage.clear();
    apiFetch.mockReset();
  });

  it("returns to login UI when an admin API call receives 401", async () => {
    setQuizAdminToken("valid-looking-token");

    // Mount checkAuth → GET /admin/me
    apiFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      data: { ok: true, authenticated: true },
      error: null,
    });

    render(
      <MemoryRouter>
        <AdminShell title="Admin Test" subtitle="subtitle">
          <button type="button" onClick={() => adminListQuestions()}>
            Load questions
          </button>
        </AdminShell>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Load questions")).toBeInTheDocument();
    });
    expect(screen.queryByText("Admin login")).not.toBeInTheDocument();

    apiFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      data: { ok: false, error: "unauthorized" },
      error: "unauthorized",
    });

    fireEvent.click(screen.getByText("Load questions"));

    await waitFor(() => {
      expect(screen.getByText("Admin login")).toBeInTheDocument();
    });
    expect(getQuizAdminToken()).toBe("");
    expect(screen.queryByText("Load questions")).not.toBeInTheDocument();
  });
});
