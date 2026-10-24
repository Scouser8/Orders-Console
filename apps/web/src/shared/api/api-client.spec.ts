import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "./api-client";
import { ApiError } from "./api-error";

describe("JSON API client", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("requests JSON through the API prefix", async () => {
    fetchMock.mockResolvedValue(Response.json({ items: [] }));

    await expect(apiRequest("/orders")).resolves.toEqual({ items: [] });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/orders");
    expect(new Headers(options?.headers).get("Accept")).toBe(
      "application/json",
    );
    expect(new Headers(options?.headers).has("Content-Type")).toBe(false);
  });

  it("sends JSON, an explicit Bearer token, and supplied headers", async () => {
    fetchMock.mockResolvedValue(Response.json({ ok: true }));
    const body = { customerName: "Test Customer" };

    await apiRequest("/orders", {
      method: "POST",
      body,
      accessToken: "test-token",
      headers: { "Idempotency-Key": "test-submission" },
    });

    const options = fetchMock.mock.calls[0][1];
    expect(options?.method).toBe("POST");
    expect(options?.body).toBe(JSON.stringify(body));
    const headers = new Headers(options?.headers);
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("Authorization")).toBe("Bearer test-token");
    expect(headers.get("Idempotency-Key")).toBe("test-submission");
  });

  it("retains the HTTP status and server error message", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ message: "Unauthorized" }, { status: 401 }),
    );

    await expect(apiRequest("/orders")).rejects.toMatchObject({
      name: "ApiError",
      status: 401,
      message: "Unauthorized",
    });
  });

  it("combines server validation messages", async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        { message: ["email must be an email", "password is required"] },
        { status: 400 },
      ),
    );

    await expect(apiRequest("/auth/login")).rejects.toMatchObject({
      status: 400,
      message: "email must be an email; password is required",
    });
  });

  it("reports non-JSON HTTP failures without a JSON parsing error", async () => {
    fetchMock.mockResolvedValue(new Response("Bad Gateway", { status: 502 }));

    await expect(apiRequest("/orders")).rejects.toEqual(
      new ApiError(502, "Request failed (502)"),
    );
  });

  it("handles a successful response without a body", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(
      apiRequest<void>("/orders/test", { method: "DELETE" }),
    ).resolves.toBeUndefined();
  });

  it("preserves network failures", async () => {
    const error = new TypeError("Failed to fetch");
    fetchMock.mockRejectedValue(error);

    await expect(apiRequest("/orders")).rejects.toBe(error);
  });

  it("passes the cancellation signal to fetch and preserves abort errors", async () => {
    const controller = new AbortController();
    fetchMock.mockImplementation(
      (_url, options) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = options?.signal;
          signal?.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          });
        }),
    );

    const pending = apiRequest("/orders", { signal: controller.signal });
    const assertion = expect(pending).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(fetchMock.mock.calls[0][1]?.signal).toBe(controller.signal);
    controller.abort();
    await assertion;
  });
});
