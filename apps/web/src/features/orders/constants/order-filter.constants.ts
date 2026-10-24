import type { OrderQuery } from "../types/order.types";

export const ORDER_SEARCH_MAX_LENGTH = 254;
export const ORDER_STATUS_COLUMN_ID = "status";
export const ORDER_SORT_OPTIONS = [
  {
    value: "newest",
    label: "Newest first",
    sortBy: "createdAt",
    sortDirection: "desc",
  },
  {
    value: "oldest",
    label: "Oldest first",
    sortBy: "createdAt",
    sortDirection: "asc",
  },
  {
    value: "highest",
    label: "Highest total first",
    sortBy: "totalAmount",
    sortDirection: "desc",
  },
  {
    value: "lowest",
    label: "Lowest total first",
    sortBy: "totalAmount",
    sortDirection: "asc",
  },
] as const satisfies readonly {
  value: string;
  label: string;
  sortBy: OrderQuery["sortBy"];
  sortDirection: OrderQuery["sortDirection"];
}[];
