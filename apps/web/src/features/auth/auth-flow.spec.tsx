// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Link, MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppRoutes } from "../../routes/app-routes";
import { AuthProvider } from "./components/auth-provider";
import { useAuth } from "./hooks/use-auth";
import { createAuthSession } from "./utils/create-auth-session";

function loginResponse(exp = Math.floor(Date.now() / 1000) + 3600) {
  return {
    accessToken: `header.${btoa(JSON.stringify({ exp }))}.signature`,
    user: { id: "test-agent", email: "agent@example.com", role: "AGENT" },
  };
}

function LocationProbe() {
  const location = useLocation();
  return (
    <>
      <output aria-label="Current path">{location.pathname}</output>
      <Link to="/login">Open login</Link>
    </>
  );
}

describe("frontend authentication", () => {
  const fetchMock = vi.fn<typeof fetch>();
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    queryClient.clear();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  function renderFlow(path = "/") {
    return render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter initialEntries={[path]}>
            <AppRoutes />
            <LocationProbe />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>,
    );
  }

  function submitCredentials(
    email = "agent@example.com",
    password = "DemoAgent123!",
  ) {
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: email },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: password },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
  }

  it("redirects unauthenticated visitors to login", async () => {
    renderFlow();
    expect(
      await screen.findByRole("heading", { name: "Sign in" }),
    ).toBeDefined();
    expect(screen.getByLabelText("Current path").textContent).toBe("/login");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("validates fields without sending an invalid request", async () => {
    renderFlow("/login");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(
      await screen.findByText("Enter a valid email address."),
    ).toBeDefined();
    expect(await screen.findByText("Enter your password.")).toBeDefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("checks the UTF-8 password byte limit", async () => {
    renderFlow("/login");
    submitCredentials("agent@example.com", "é".repeat(37));
    expect(
      await screen.findByText("Password must be at most 72 bytes."),
    ).toBeDefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("displays server credential errors and allows retry", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ message: "Invalid email or password" }, { status: 401 }),
    );
    renderFlow("/login");
    submitCredentials();
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Invalid email or password",
    );
    expect(screen.getByRole("button", { name: "Sign in" })).toHaveProperty(
      "disabled",
      false,
    );
    expect(screen.getByLabelText("Current path").textContent).toBe("/login");
  });

  it("logs in, normalizes email, and clears private data on login and logout", async () => {
    fetchMock.mockResolvedValue(Response.json(loginResponse()));
    renderFlow();
    queryClient.setQueryData(["previous-session"], { private: true });
    submitCredentials(" AGENT@EXAMPLE.COM ");
    const signOut = await screen.findByRole("button", { name: "Sign out" });

    expect(fetchMock.mock.calls[0][0]).toBe("/api/auth/login");
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      email: "agent@example.com",
      password: "DemoAgent123!",
    });
    expect(screen.getByLabelText("Current path").textContent).toBe("/");
    expect(screen.getByText("agent@example.com · AGENT")).toBeDefined();
    expect(queryClient.getQueryData(["previous-session"])).toBeUndefined();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(document.cookie).toBe("");

    queryClient.setQueryData(["private-data"], { private: true });
    fireEvent.click(signOut);
    expect(
      await screen.findByRole("heading", { name: "Sign in" }),
    ).toBeDefined();
    expect(queryClient.getQueryData(["private-data"])).toBeUndefined();
    expect(screen.getByLabelText("Current path").textContent).toBe("/login");
  });

  it("redirects authenticated visitors away from login", async () => {
    fetchMock.mockResolvedValue(Response.json(loginResponse()));
    renderFlow("/login");
    submitCredentials();
    await screen.findByRole("button", { name: "Sign out" });
    fireEvent.click(screen.getByRole("link", { name: "Open login" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Current path").textContent).toBe("/"),
    );
    expect(screen.getByRole("button", { name: "Sign out" })).toBeDefined();
  });

  it("does not restore a session after a fresh application mount", async () => {
    fetchMock.mockResolvedValue(Response.json(loginResponse()));
    const view = renderFlow("/login");
    submitCredentials();
    await screen.findByRole("button", { name: "Sign out" });
    view.unmount();
    renderFlow();
    expect(
      await screen.findByRole("heading", { name: "Sign in" }),
    ).toBeDefined();
    expect(screen.getByLabelText("Current path").textContent).toBe("/login");
  });

  it("disables submission while pending and cancels login on unmount", async () => {
    fetchMock.mockImplementation(
      (_url, options) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = options?.signal;
          signal?.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          });
        }),
    );
    const view = renderFlow("/login");
    submitCredentials();
    expect(
      await screen.findByRole("button", { name: "Signing in…" }),
    ).toHaveProperty("disabled", true);
    const signal = fetchMock.mock.calls[0][1]?.signal;
    view.unmount();
    expect(signal?.aborted).toBe(true);
  });

  it.each([
    { accessToken: "invalid", user: loginResponse().user },
    loginResponse(Math.floor(Date.now() / 1000) - 1),
  ])(
    "does not accept an invalid or expired server session %#",
    async (response) => {
      fetchMock.mockResolvedValue(Response.json(response));
      renderFlow("/login");
      submitCredentials();
      expect((await screen.findByRole("alert")).textContent).toBe(
        "Unable to sign in. Please try again.",
      );
      expect(screen.getByLabelText("Current path").textContent).toBe("/login");
    },
  );

  it("ends the local session and clears cached data at expiry", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    function SessionHarness() {
      const { session, signIn } = useAuth();
      return (
        <>
          <p>{session ? "Session active" : "Session ended"}</p>
          <button
            onClick={() =>
              signIn(
                createAuthSession(
                  loginResponse(Math.floor(Date.now() / 1000) + 1),
                ),
              )
            }
          >
            Create test session
          </button>
        </>
      );
    }
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SessionHarness />
        </AuthProvider>
      </QueryClientProvider>,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Create test session" }),
    );
    expect(screen.getByText("Session active")).toBeDefined();
    queryClient.setQueryData(["private-data"], { private: true });
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText("Session ended")).toBeDefined();
    expect(queryClient.getQueryData(["private-data"])).toBeUndefined();
  });
});
