import { z } from "zod";
import {
  MAX_ORDER_EMAIL_LENGTH,
  MAX_ORDER_ITEMS,
  MAX_ORDER_NAME_LENGTH,
  MAX_ORDER_QUANTITY,
} from "../constants/order-create.constants";
import { MAX_ORDER_AMOUNT } from "../constants/order-money.constants";
import { parseOrderPrice } from "../utils/order-money";
import { orderSchema } from "./order.schema";

const itemSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter an item name.")
    .max(MAX_ORDER_NAME_LENGTH),
  quantity: z
    .number({ error: "Enter a valid quantity." })
    .int("Use a whole-number quantity.")
    .min(1)
    .max(MAX_ORDER_QUANTITY),
  unitPrice: z.string().transform((value, context) => {
    const price = parseOrderPrice(value);
    if (price === null) {
      context.addIssue({
        code: "custom",
        message:
          "Enter a nonnegative SAR price with at most two decimals, within the supported range.",
      });
      return z.NEVER;
    }
    return price;
  }),
});

export const createOrderFormSchema = z
  .object({
    customerName: z
      .string()
      .trim()
      .min(1, "Enter a customer name.")
      .max(MAX_ORDER_NAME_LENGTH),
    customerEmail: z
      .string()
      .trim()
      .toLowerCase()
      .pipe(
        z.email("Enter a valid email address.").max(MAX_ORDER_EMAIL_LENGTH),
      ),
    items: z
      .array(itemSchema)
      .min(1, "Add at least one item.")
      .max(MAX_ORDER_ITEMS),
  })
  .superRefine((order, context) => {
    const total = order.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0,
    );
    if (total > MAX_ORDER_AMOUNT)
      context.addIssue({
        code: "custom",
        path: ["items"],
        message: "Order total exceeds the supported amount.",
      });
  });

export const createdOrderSchema = orderSchema.extend({
  items: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      quantity: z.number().int(),
      unitPrice: z.number().int(),
    }),
  ),
});
