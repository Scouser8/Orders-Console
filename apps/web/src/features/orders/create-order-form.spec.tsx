// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext } from "../auth/auth-context";
import type { AuthContextValue } from "../auth/types/auth.types";
import { CreateOrderForm } from "./components/create-order-form";
import {
  CREATE_ORDER_TIMEOUT_MS,
  MAX_ORDER_ITEMS,
} from "./constants/order-create.constants";
import {
  DEFAULT_ORDER_QUERY,
  orderQueryKeys,
} from "./constants/order.constants";
import { useCreateOrder } from "./hooks/use-create-order";
import { createOrderFormSchema } from "./schemas/create-order.schema";
import type { CreateOrderPayload } from "./types/order-create.types";

const auth: AuthContextValue = {
  session: {
    accessToken: "test-token",
    expiresAt: Date.now() + 3600000,
    user: { id: "agent", email: "agent@example.com", role: "AGENT" },
  },
  signIn: () => {},
  signOut: () => {},
};
const payload: CreateOrderPayload = {
  customerName: "Test Customer",
  customerEmail: "customer@example.com",
  items: [{ name: "Keyboard", quantity: 2, unitPrice: 29 }],
};
function createdOrder() {
  return {
    ...payload,
    id: "created-order",
    totalAmount: 58,
    status: "PENDING",
    createdAt: "2026-01-01T10:00:00.000Z",
    items: payload.items.map((item) => ({ ...item, id: "item-1" })),
  };
}

describe("create-order form", () => {
  const fetchMock = vi.fn<typeof fetch>();
  let client: QueryClient;
  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    cleanup();
    client.clear();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
      </QueryClientProvider>
    );
  }
  function fillForm() {
    fireEvent.change(screen.getByLabelText("Customer name"), {
      target: { value: " Test Customer " },
    });
    fireEvent.change(screen.getByLabelText("Customer email"), {
      target: { value: " CUSTOMER@EXAMPLE.COM " },
    });
    fireEvent.change(screen.getByLabelText("Item name"), {
      target: { value: " Keyboard " },
    });
    fireEvent.change(screen.getByLabelText("Quantity"), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByLabelText("Unit price (SAR)"), {
      target: { value: "0.29" },
    });
  }

  it("validates before sending and supports repeatable items with an exact money preview", async () => {
    render(<CreateOrderForm />, { wrapper: Wrapper });
    fireEvent.click(screen.getByRole("button", { name: "Create order" }));
    await screen.findByText("Enter a customer name.");
    expect(fetchMock).not.toHaveBeenCalled();
    fillForm();
    expect(screen.getByLabelText("Calculated total").textContent).toContain(
      "0.58",
    );
    fireEvent.click(screen.getByRole("button", { name: "Add item" }));
    const names = screen.getAllByLabelText("Item name");
    fireEvent.change(names[1], { target: { value: "Mouse" } });
    fireEvent.change(screen.getAllByLabelText("Unit price (SAR)")[1], {
      target: { value: "1.01" },
    });
    expect(screen.getByLabelText("Calculated total").textContent).toContain(
      "1.59",
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove item 1" }));
    expect(screen.getByLabelText("Item name")).toHaveProperty("value", "Mouse");
    expect(screen.getByLabelText("Calculated total").textContent).toContain(
      "1.01",
    );
    expect(
      screen.getByRole("button", { name: "Remove item 1" }),
    ).toHaveProperty("disabled", true);
    fireEvent.change(screen.getByLabelText("Unit price (SAR)"), {
      target: { value: "1.005" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create order" }));
    await screen.findByText(/Enter a nonnegative SAR price/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends a normalized payload once, confirms the server total, and invalidates order queries", async () => {
    let resolveRequest!: (response: Response) => void;
    fetchMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );
    const key = orderQueryKeys.list("agent", DEFAULT_ORDER_QUERY);
    client.setQueryData(key, { pages: [], pageParams: [] });
    client.setQueryData(["unrelated"], "keep");
    const view = render(<CreateOrderForm />, { wrapper: Wrapper });
    fillForm();
    const form = view.container.querySelector("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/orders");
    expect(JSON.parse(String(options?.body))).toEqual(payload);
    const headers = new Headers(options?.headers);
    expect(headers.get("Authorization")).toBe("Bearer test-token");
    expect(headers.get("Idempotency-Key")).toMatch(/^[\da-f-]{36}$/);
    expect(
      screen.getByLabelText("Customer name").closest("fieldset"),
    ).toHaveProperty("disabled", true);
    expect(
      screen.getByRole("button", { name: "Creating order…" }),
    ).toHaveProperty("disabled", true);
    await act(async () => {
      resolveRequest(
        Response.json({ ...createdOrder(), totalAmount: 60 }, { status: 201 }),
      );
    });
    const confirmation = await screen.findByText(
      /Order created-order created\. Saved total:/,
    );
    expect(confirmation.textContent).toContain("0.60");
    expect(client.getQueryState(key)?.isInvalidated).toBe(true);
    expect(client.getQueryState(["unrelated"])?.isInvalidated).toBe(false);
    fireEvent.submit(form);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reuses the exact key/payload after a lost response and starts a new key only for another order", async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError("Network response lost"))
      .mockImplementation(async () =>
        Response.json(createdOrder(), { status: 201 }),
      );
    render(<CreateOrderForm />, { wrapper: Wrapper });
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Create order" }));
    await screen.findByRole("alert");
    expect(
      screen.getByLabelText("Customer name").closest("fieldset"),
    ).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByRole("button", { name: "Retry order" }));
    await screen.findByRole("button", { name: "Create another order" });
    const original = fetchMock.mock.calls[0][1];
    const retry = fetchMock.mock.calls[1][1];
    expect(retry?.body).toBe(original?.body);
    expect(new Headers(retry?.headers).get("Idempotency-Key")).toBe(
      new Headers(original?.headers).get("Idempotency-Key"),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Create another order" }),
    );
    expect(screen.getByLabelText("Customer name")).toHaveProperty("value", "");
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Create order" }));
    await screen.findByRole("button", { name: "Create another order" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(
      new Headers(fetchMock.mock.calls[2][1]?.headers).get("Idempotency-Key"),
    ).not.toBe(new Headers(original?.headers).get("Idempotency-Key"));
  });

  it("allows correcting a definitive server validation rejection", async () => {
    fetchMock
      .mockResolvedValueOnce(
        Response.json({ message: "Invalid customer" }, { status: 400 }),
      )
      .mockResolvedValueOnce(Response.json(createdOrder(), { status: 201 }));
    render(<CreateOrderForm />, { wrapper: Wrapper });
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Create order" }));
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Invalid customer",
    );
    expect(
      screen.getByLabelText("Customer name").closest("fieldset"),
    ).toHaveProperty("disabled", false);
    fireEvent.change(screen.getByLabelText("Customer name"), {
      target: { value: "Corrected" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create order" }));
    await screen.findByRole("button", { name: "Create another order" });
    expect(
      JSON.parse(String(fetchMock.mock.calls[1][1]?.body)).customerName,
    ).toBe("Corrected");
    expect(
      new Headers(fetchMock.mock.calls[1][1]?.headers).get("Idempotency-Key"),
    ).toBe(
      new Headers(fetchMock.mock.calls[0][1]?.headers).get("Idempotency-Key"),
    );
  });

  it("does not keep retrying a deleted order", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ message: "Order was deleted" }, { status: 410 }),
    );
    render(<CreateOrderForm />, { wrapper: Wrapper });
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Create order" }));
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Order was deleted",
    );
    expect(
      screen.getByRole("button", { name: "Create another order" }),
    ).toBeDefined();
    expect(screen.queryByRole("button", { name: "Retry order" })).toBeNull();
  });

  it("times out, aborts the request, and reuses the same submission on retry", async () => {
    vi.useFakeTimers();
    fetchMock
      .mockImplementationOnce(
        (_url, options) =>
          new Promise((_resolve, reject) => {
            options?.signal?.addEventListener(
              "abort",
              () => reject(options.signal?.reason),
              { once: true },
            );
          }),
      )
      .mockResolvedValueOnce(Response.json(createdOrder(), { status: 201 }));
    const view = renderHook(() => useCreateOrder(), { wrapper: Wrapper });
    await act(async () => {
      view.result.current.submit(payload);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(CREATE_ORDER_TIMEOUT_MS + 1);
    });
    expect(view.result.current.isError).toBe(true);
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
    await act(async () => {
      view.result.current.submit({
        ...payload,
        customerName: "Should not replace the pending snapshot",
      });
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(view.result.current.isSuccess).toBe(true);
    expect(fetchMock.mock.calls[1][1]?.body).toBe(
      fetchMock.mock.calls[0][1]?.body,
    );
    expect(
      new Headers(fetchMock.mock.calls[1][1]?.headers).get("Idempotency-Key"),
    ).toBe(
      new Headers(fetchMock.mock.calls[0][1]?.headers).get("Idempotency-Key"),
    );
  });

  it("aborts pending creation when the form unmounts", async () => {
    fetchMock.mockImplementation(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener(
            "abort",
            () => reject(options.signal?.reason),
            { once: true },
          );
        }),
    );
    const view = render(<CreateOrderForm />, { wrapper: Wrapper });
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Create order" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    view.unmount();
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
  });

  it.each([
    { quantity: 1.5, unitPrice: "1.00" },
    { quantity: 10001, unitPrice: "1.00" },
    { quantity: 1, unitPrice: "-1" },
    { quantity: 1, unitPrice: "1e2" },
    { quantity: 1, unitPrice: "21474836.48" },
    { quantity: 2, unitPrice: "21474836.47" },
  ])("rejects invalid quantities/prices and total overflow: %j", (item) => {
    expect(
      createOrderFormSchema.safeParse({
        ...payload,
        items: [{ name: "Item", ...item }],
      }).success,
    ).toBe(false);
  });
  it("enforces the maximum item count", () => {
    const item = { name: "Item", quantity: 1, unitPrice: "0.00" };
    expect(
      createOrderFormSchema.safeParse({
        ...payload,
        items: Array.from({ length: MAX_ORDER_ITEMS + 1 }, () => item),
      }).success,
    ).toBe(false);
  });
});
