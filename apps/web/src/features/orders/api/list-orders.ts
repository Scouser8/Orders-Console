import { apiRequest } from "../../../shared/api/api-client";
import { ORDER_PAGE_SIZE } from "../constants/order.constants";
import { orderPageSchema } from "../schemas/order.schema";
import type { OrderQuery } from "../types/order.types";

export async function listOrders(
  query: OrderQuery,
  cursor: string | null,
  accessToken: string,
  signal: AbortSignal,
) {
  const params = new URLSearchParams({
    sortBy: query.sortBy,
    sortDirection: query.sortDirection,
    limit: String(ORDER_PAGE_SIZE),
  });
  if (query.search) params.set("search", query.search);
  if (query.status) params.set("status", query.status);
  if (cursor) params.set("cursor", cursor);
  const response = await apiRequest<unknown>(`/orders?${params}`, {
    accessToken,
    signal,
  });
  return orderPageSchema.parse(response);
}
