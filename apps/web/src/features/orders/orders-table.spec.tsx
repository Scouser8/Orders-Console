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
import { OrdersTable } from "./components/orders-table";
import {
  DEFAULT_ORDER_QUERY,
  ORDER_ROW_HEIGHT,
} from "./constants/order.constants";
import { useOrders } from "./hooks/use-orders";
import type { Order, OrderQuery } from "./types/order.types";
import { HomePage } from "../../pages/home-page";

const auth: AuthContextValue = {
  session: {
    accessToken: "test-token",
    expiresAt: Date.now() + 3600000,
    user: { id: "agent", email: "agent@example.com", role: "AGENT" },
  },
  signIn: () => {},
  signOut: () => {},
};
function page(
  start: number,
  count: number,
  nextCursor: string | null,
  status: Order["status"] = "PENDING",
) {
  return {
    items: Array.from({ length: count }, (_, offset) => ({
      id: `order-${start + offset}`,
      customerName: `Customer ${start + offset}`,
      customerEmail: `customer-${start + offset}@example.com`,
      status,
      totalAmount: 12345,
      createdAt: "2026-01-01T10:00:00.000Z",
    })),
    nextCursor,
  };
}

describe("orders table", () => {
  const fetchMock = vi.fn<typeof fetch>();
  const scrollIntoViewMock = vi.fn();
  const originalScrollIntoView = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "scrollIntoView",
  );
  let client: QueryClient;
  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    scrollIntoViewMock.mockReset();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoViewMock,
    });
    // jsdom has no layout; retain the real virtualizer with a measured viewport.
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(480);
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(1000);
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });
  afterEach(() => {
    cleanup();
    client.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    if (originalScrollIntoView)
      Object.defineProperty(
        HTMLElement.prototype,
        "scrollIntoView",
        originalScrollIntoView,
      );
    else Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
      </QueryClientProvider>
    );
  }

  it("loads authenticated pages, virtualizes rows, and fetches on scroll", async () => {
    fetchMock
      .mockResolvedValueOnce(Response.json(page(0, 50, "next-page")))
      .mockResolvedValueOnce(Response.json(page(50, 50, null)));
    render(<OrdersTable />, { wrapper: Wrapper });
    expect(screen.getByRole("status").textContent).toContain("Loading orders");
    expect(await screen.findByText("Customer 0")).toBeDefined();
    expect(screen.getAllByText("Pending").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/123.45/).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("row").length).toBeLessThan(25);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toContain(
      "sortBy=createdAt&sortDirection=desc&limit=50",
    );
    expect(new Headers(options?.headers).get("Authorization")).toBe(
      "Bearer test-token",
    );
    expect(options?.signal).toBeInstanceOf(AbortSignal);

    const scroll = screen.getByRole("region", { name: "Scrollable orders" });
    fireEvent.scroll(scroll, { target: { scrollTop: 46 * ORDER_ROW_HEIGHT } });
    await screen.findByText("100 orders loaded · Newest first");
    expect(String(fetchMock.mock.calls[1][0])).toContain("cursor=next-page");
    expect(screen.getAllByRole("row").length).toBeLessThan(30);
    expect(screen.getByText("All matching orders loaded.")).toBeDefined();
    fireEvent.scroll(scroll, { target: { scrollTop: 90 * ORDER_ROW_HEIGHT } });
    await screen.findByText("Customer 95");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("shows an empty result", async () => {
    fetchMock.mockResolvedValue(Response.json(page(0, 0, null)));
    render(<OrdersTable />, { wrapper: Wrapper });
    expect(await screen.findByText("No orders found.")).toBeDefined();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("retries initial errors", async () => {
    fetchMock
      .mockResolvedValueOnce(Response.json({}, { status: 500 }))
      .mockResolvedValueOnce(Response.json(page(0, 1, null)));
    render(<OrdersTable />, { wrapper: Wrapper });
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Customer 0")).toBeDefined();
  });

  it("keeps loaded rows after a page failure and retries the same cursor", async () => {
    fetchMock
      .mockResolvedValueOnce(Response.json(page(0, 50, "retry-cursor")))
      .mockResolvedValueOnce(Response.json({}, { status: 500 }))
      .mockResolvedValueOnce(Response.json(page(50, 1, null)));
    render(<OrdersTable />, { wrapper: Wrapper });
    await screen.findByText("Customer 0");
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(await screen.findByRole("alert")).toBeDefined();
    expect(screen.getByText("Customer 0")).toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole("button", { name: "Retry loading more" }));
    await screen.findByText("51 orders loaded · Newest first");
    expect(fetchMock.mock.calls[1][0]).toBe(fetchMock.mock.calls[2][0]);
  });

  it("cancels pending fetches when unmounted", async () => {
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
    const view = render(<OrdersTable />, { wrapper: Wrapper });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const signal = fetchMock.mock.calls[0][1]?.signal;
    view.unmount();
    expect(signal?.aborted).toBe(true);
  });

  it("uses every query input in the cache key and resets pagination", async () => {
    fetchMock.mockImplementation(async () => Response.json(page(0, 1, "next")));
    const view = renderHook(
      ({ query }: { query: OrderQuery }) => useOrders(query),
      {
        wrapper: Wrapper,
        initialProps: { query: DEFAULT_ORDER_QUERY },
      },
    );
    await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
    await act(async () => {
      await view.result.current.fetchNextPage();
    });
    expect(String(fetchMock.mock.calls[1][0])).toContain("cursor=next");
    let query = DEFAULT_ORDER_QUERY;
    for (const change of [
      { search: "Alice & Bob" },
      { status: "PENDING" as const },
      { sortBy: "totalAmount" as const },
      { sortDirection: "asc" as const },
    ]) {
      query = { ...query, ...change };
      const previousCalls = fetchMock.mock.calls.length;
      view.rerender({ query });
      await waitFor(() =>
        expect(fetchMock.mock.calls.length).toBe(previousCalls + 1),
      );
      await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
      expect(String(fetchMock.mock.lastCall?.[0])).not.toContain("cursor=");
    }
    const url = new URL(
      String(fetchMock.mock.lastCall?.[0]),
      "http://localhost",
    );
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      search: "Alice & Bob",
      status: "PENDING",
      sortBy: "totalAmount",
      sortDirection: "asc",
    });
    expect(client.getQueryCache().getAll()).toHaveLength(5);
  });

  it("sends combined search/status/sort controls to the server and resets the viewport", async () => {
    fetchMock.mockImplementation(async (url) => {
      const cursor = new URL(String(url), "http://localhost").searchParams.get(
        "cursor",
      );
      return Response.json(page(cursor ? 50 : 0, 50, "more"));
    });
    render(<OrdersTable />, { wrapper: Wrapper });
    await screen.findByText("Customer 0");
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    await screen.findByText("100 orders loaded · Newest first");
    fireEvent.scroll(
      screen.getByRole("region", { name: "Scrollable orders" }),
      {
        target: { scrollTop: 10 * ORDER_ROW_HEIGHT },
      },
    );
    fireEvent.change(screen.getByLabelText("Search customers"), {
      target: { value: "  Alice & Bob@example.com  " },
    });
    await screen.findByText("50 orders loaded · Newest first");
    expect(
      screen.getByRole("region", { name: "Scrollable orders" }).scrollTop,
    ).toBe(0);
    expect(screen.getByText("Customer 0")).toBeDefined();
    fireEvent.change(screen.getByLabelText("Status"), {
      target: { value: "PENDING" },
    });
    await waitFor(() =>
      expect(String(fetchMock.mock.lastCall?.[0])).toContain("status=PENDING"),
    );
    for (const [value, sortBy, sortDirection] of [
      ["oldest", "createdAt", "asc"],
      ["highest", "totalAmount", "desc"],
      ["lowest", "totalAmount", "asc"],
      ["newest", "createdAt", "desc"],
    ]) {
      const previousCalls = fetchMock.mock.calls.length;
      fireEvent.change(screen.getByLabelText("Sort orders"), {
        target: { value },
      });
      await waitFor(() =>
        expect(fetchMock.mock.calls.length).toBeGreaterThan(previousCalls),
      );
      const params = new URL(
        String(fetchMock.mock.lastCall?.[0]),
        "http://localhost",
      ).searchParams;
      expect(Object.fromEntries(params)).toMatchObject({
        search: "Alice & Bob@example.com",
        status: "PENDING",
        sortBy,
        sortDirection,
      });
      expect(params.has("cursor")).toBe(false);
      await screen.findByText("Customer 0");
    }
    fireEvent.change(screen.getByLabelText("Status"), {
      target: { value: "" },
    });
    await waitFor(() =>
      expect(String(fetchMock.mock.lastCall?.[0])).not.toContain("status="),
    );
    expect(screen.getByLabelText("Search customers")).toHaveProperty(
      "maxLength",
      254,
    );
  });

  it("keeps only the latest results after three rapid status changes with delayed older responses", async () => {
    const delayed: {
      resolve: (value: Response) => void;
      signal: AbortSignal | null | undefined;
    }[] = [];
    fetchMock
      .mockResolvedValueOnce(Response.json(page(0, 1, null)))
      // Deliberately ignore cancellation, simulating responses already in flight.
      .mockImplementation(
        (_url, options) =>
          new Promise<Response>((resolve) => {
            delayed.push({ resolve, signal: options?.signal });
          }),
      );
    render(<OrdersTable />, { wrapper: Wrapper });
    await screen.findByText("Customer 0");
    for (const [index, status] of [
      "PENDING",
      "PROCESSING",
      "COMPLETED",
    ].entries()) {
      fireEvent.change(screen.getByLabelText("Status"), {
        target: { value: status },
      });
      await waitFor(() => expect(delayed).toHaveLength(index + 1));
    }
    expect(delayed[0].signal?.aborted).toBe(true);
    expect(delayed[1].signal?.aborted).toBe(true);
    expect(delayed[2].signal?.aborted).toBe(false);
    expect(screen.queryByText("Customer 0")).toBeNull();
    expect(screen.getByLabelText("Status")).toHaveProperty(
      "value",
      "COMPLETED",
    );
    await act(async () => {
      delayed[2].resolve(Response.json(page(300, 1, null, "COMPLETED")));
    });
    await screen.findByText("Customer 300");
    for (const [index, start] of [
      [1, 200],
      [0, 100],
    ]) {
      await act(async () => {
        delayed[index].resolve(
          Response.json(
            page(start, 1, null, index === 1 ? "PROCESSING" : "PENDING"),
          ),
        );
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
      expect(screen.getByText("Customer 300")).toBeDefined();
      expect(screen.queryByText(`Customer ${start}`)).toBeNull();
    }
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("cancels a pending next page when search changes and ignores its delayed result", async () => {
    let resolveOldPage!: (value: Response) => void;
    fetchMock
      .mockResolvedValueOnce(Response.json(page(0, 50, "old-cursor")))
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveOldPage = resolve;
          }),
      )
      .mockResolvedValueOnce(Response.json(page(500, 1, null)));
    render(<OrdersTable />, { wrapper: Wrapper });
    await screen.findByText("Customer 0");
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const oldSignal = fetchMock.mock.calls[1][1]?.signal;
    fireEvent.change(screen.getByLabelText("Search customers"), {
      target: { value: "new customer" },
    });
    await screen.findByText("Customer 500");
    expect(oldSignal?.aborted).toBe(true);
    expect(String(fetchMock.mock.calls[2][0])).not.toContain("cursor=");
    await act(async () => {
      resolveOldPage(Response.json(page(50, 50, null)));
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(screen.getByText("Customer 500")).toBeDefined();
    expect(screen.queryByText("Customer 0")).toBeNull();
    expect(screen.queryByText("Customer 50")).toBeNull();
    expect(screen.getByText("1 orders loaded · Newest first")).toBeDefined();
  });

  it.each([false, true])(
    "reveals a confirmed order, clears filters, and focuses its row once (reduced motion: %s)",
    async (reducedMotion) => {
      vi.stubGlobal(
        "matchMedia",
        vi.fn().mockReturnValue({ matches: reducedMotion }),
      );
      let saved = false;
      let confirmCreation!: () => void;
      const created = {
        id: "new-order",
        customerName: "New Customer",
        customerEmail: "new@example.com",
        totalAmount: 1000,
        status: "PENDING",
        createdAt: "2026-10-24T10:00:00.000Z",
        items: [
          { id: "new-item", name: "Keyboard", quantity: 1, unitPrice: 1000 },
        ],
      };
      fetchMock.mockImplementation(async (_url, options) => {
        if (options?.method === "POST")
          return new Promise<Response>((resolve) => {
            confirmCreation = () => {
              saved = true;
              resolve(Response.json(created, { status: 201 }));
            };
          });
        return Response.json(
          saved ? { items: [created], nextCursor: null } : page(0, 50, null),
        );
      });
      render(<HomePage />, { wrapper: Wrapper });
      await screen.findByText("Customer 0");
      fireEvent.change(screen.getByLabelText("Search customers"), {
        target: { value: "Old customer" },
      });
      fireEvent.change(screen.getByLabelText("Status"), {
        target: { value: "COMPLETED" },
      });
      fireEvent.change(screen.getByLabelText("Sort orders"), {
        target: { value: "lowest" },
      });
      await screen.findByText("50 orders loaded · Lowest total first");
      fireEvent.scroll(
        screen.getByRole("region", { name: "Scrollable orders" }),
        { target: { scrollTop: 10 * ORDER_ROW_HEIGHT } },
      );

      fireEvent.change(screen.getByLabelText("Customer name"), {
        target: { value: "New Customer" },
      });
      fireEvent.change(screen.getByLabelText("Customer email"), {
        target: { value: "new@example.com" },
      });
      fireEvent.change(screen.getByLabelText("Item name"), {
        target: { value: "Keyboard" },
      });
      fireEvent.change(screen.getByLabelText("Unit price (SAR)"), {
        target: { value: "10.00" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Create order" }));
      await screen.findByRole("button", { name: "Creating order…" });
      expect(scrollIntoViewMock).not.toHaveBeenCalled();
      expect(screen.getByLabelText("Status")).toHaveProperty(
        "value",
        "COMPLETED",
      );
      await act(async () => {
        confirmCreation();
      });

      const row = (await screen.findByText("new-order")).closest("tr");
      await waitFor(() => expect(document.activeElement).toBe(row));
      expect(row?.className).toContain("focus:bg-emerald-50");
      expect(scrollIntoViewMock).toHaveBeenCalledExactlyOnceWith({
        behavior: reducedMotion ? "auto" : "smooth",
        block: "center",
        inline: "nearest",
      });
      expect(screen.getByLabelText("Search customers")).toHaveProperty(
        "value",
        "",
      );
      expect(screen.getByLabelText("Status")).toHaveProperty("value", "");
      expect(screen.getByLabelText("Sort orders")).toHaveProperty(
        "value",
        "newest",
      );
      expect(
        screen.getByRole("region", { name: "Scrollable orders" }).scrollTop,
      ).toBe(0);
      expect(screen.getByText("1 orders loaded · Newest first")).toBeDefined();

      // Changing filters remounts the virtual viewport, but must not steal focus.
      const search = screen.getByLabelText("Search customers");
      search.focus();
      fireEvent.change(search, { target: { value: "New Customer" } });
      await screen.findByText("new-order");
      expect(document.activeElement).toBe(search);
      expect(scrollIntoViewMock).toHaveBeenCalledTimes(1);
    },
  );
});
