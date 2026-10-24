import { z } from "zod";
import { ORDER_STATUSES } from "../constants/order.constants";

export const orderSchema = z.object({
  id: z.string().min(1),
  customerName: z.string(),
  customerEmail: z.string(),
  status: z.enum(ORDER_STATUSES),
  totalAmount: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
});
export const orderPageSchema = z.object({
  items: z.array(orderSchema),
  nextCursor: z.string().min(1).nullable(),
});
