import type { z } from "zod";
import type { orderPageSchema, orderSchema } from "../schemas/order.schema";

export type Order = z.infer<typeof orderSchema>;
export type OrderPage = z.infer<typeof orderPageSchema>;
export interface OrderQuery {
  search: string;
  status: Order["status"] | "";
  sortBy: "createdAt" | "totalAmount";
  sortDirection: "asc" | "desc";
}
