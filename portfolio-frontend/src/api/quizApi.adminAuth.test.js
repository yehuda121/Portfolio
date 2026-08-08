import { setQuizAdminToken, getQuizAdminToken, adminCheckAuth, subscribeAdminUnauthorized } from "./quizApi";

jest.mock("./client", () => ({
  apiFetch: jest.fn(),
}));

import { apiFetch } from "./client";

describe("admin API unauthorized handling", () => {
  beforeEach(() => {
    sessionStorage.clear();
    apiFetch.mockReset();
  });

  it("clears stored admin token on 401", async () => {
    setQuizAdminToken("stale-token");
    expect(getQuizAdminToken()).toBe("stale-token");

    apiFetch.mockResolvedValue({
      ok: false,
      status: 401,
      data: { ok: false, error: "unauthorized" },
      error: "unauthorized",
    });

    await adminCheckAuth();
    expect(getQuizAdminToken()).toBe("");
  });

  it("keeps token when auth succeeds", async () => {
    setQuizAdminToken("good-token");
    apiFetch.mockResolvedValue({
      ok: true,
      status: 200,
      data: { ok: true, authenticated: true },
      error: null,
    });

    await adminCheckAuth();
    expect(getQuizAdminToken()).toBe("good-token");
  });

  it("notifies subscribers once on 401", async () => {
    const listener = jest.fn();
    const unsubscribe = subscribeAdminUnauthorized(listener);

    setQuizAdminToken("stale-token");
    apiFetch.mockResolvedValue({
      ok: false,
      status: 401,
      data: { ok: false, error: "unauthorized" },
      error: "unauthorized",
    });

    await adminCheckAuth();
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    await adminCheckAuth();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
