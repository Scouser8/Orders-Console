import type { OrderQuery } from "../types/order.types";

export const ORDER_STATUSES = [
  "PENDING",
  "PROCESSING",
  "COMPLETED",
  "CANCELLED",
] as const;
export const ORDER_STATUS_LABELS = {
  PENDING: "Pending",
  PROCESSING: "Processing",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
} satisfies Record<(typeof ORDER_STATUSES)[number], string>;
export const ORDER_PAGE_SIZE = 50;
export const ORDER_ROW_HEIGHT = 48;
export const ORDER_VIEWPORT_HEIGHT = 480;
export const ORDER_OVERSCAN = 5;
export const ORDER_PREFETCH_ROWS = 5;
export const DEFAULT_ORDER_QUERY: OrderQuery = {
  search: "",
  status: "",
  sortBy: "createdAt",
  sortDirection: "desc",
};
export const orderQueryKeys = {
  all: ["orders"] as const,
  list: (userId: string | undefined, query: OrderQuery) =>
    ["orders", userId, query] as const,
};
