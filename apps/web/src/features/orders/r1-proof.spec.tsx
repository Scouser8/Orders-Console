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
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext } from "../auth/auth-context";
import type { AuthContextValue } from "../auth/types/auth.types";
import { OrdersTable } from "./components/orders-table";
import type { Order } from "./types/order.types";

const auth: AuthContextValue = {
  session: {
    accessToken: "r1-proof-token",
    expiresAt: Date.now() + 3_600_000,
    user: { id: "agent", email: "agent@example.com", role: "AGENT" },
  },
  signIn: () => {},
  signOut: () => {},
};

function page(start: number, status: Order["status"]) {
  return {
    items: [
      {
        id: `order-${start}`,
        customerName: `Customer ${start}`,
        customerEmail: `customer-${start}@example.com`,
        status,
        totalAmount: 12345,
        createdAt: "2026-01-01T10:00:00.000Z",
      },
    ],
    nextCursor: null,
  };
}

describe("R1 rapid-filter proof", () => {
  const fetchMock = vi.fn<typeof fetch>();
  let client: QueryClient;

  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
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
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
      </QueryClientProvider>
    );
  }

  it("keeps the newest filter result when earlier responses arrive later", async () => {
    const delayed: Array<{
      resolve: (response: Response) => void;
      signal: AbortSignal | null | undefined;
    }> = [];
    fetchMock
      .mockResolvedValueOnce(Response.json(page(0, "PENDING")))
      .mockImplementation(
        (_url, options) =>
          new Promise<Response>((resolve) =>
            delayed.push({ resolve, signal: options?.signal }),
          ),
      );

    render(<OrdersTable />, { wrapper: Wrapper });
    await screen.findByText("Customer 0");

    const statuses = ["PENDING", "PROCESSING", "COMPLETED"] as const;
    for (const [index, status] of statuses.entries()) {
      fireEvent.change(screen.getByLabelText("Status"), {
        target: { value: status },
      });
      await waitFor(() => expect(delayed).toHaveLength(index + 1));
    }

    await act(async () => {
      delayed[2].resolve(Response.json(page(300, "COMPLETED")));
    });
    await screen.findByText("Customer 300");

    await act(async () => {
      delayed[1].resolve(Response.json(page(200, "PROCESSING")));
      delayed[0].resolve(Response.json(page(100, "PENDING")));
    });

    console.log("\nR1 rapid-filter proof");
    console.log("- filters sent: PENDING -> PROCESSING -> COMPLETED");
    console.log(
      "- delayed responses released: COMPLETED -> PROCESSING -> PENDING",
    );
    console.log(
      `- visible result: ${screen.getByText("Customer 300").textContent}`,
    );
    console.log(
      `- older requests aborted: ${delayed[0].signal?.aborted}, ${delayed[1].signal?.aborted}`,
    );

    expect(screen.getByText("Customer 300")).toBeDefined();
    expect(screen.queryByText("Customer 200")).toBeNull();
    expect(screen.queryByText("Customer 100")).toBeNull();
    expect(delayed[0].signal?.aborted).toBe(true);
    expect(delayed[1].signal?.aborted).toBe(true);
  });
});
