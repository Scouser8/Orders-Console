import {
  HALALAS_PER_RIYAL,
  MAX_ORDER_AMOUNT,
  MONEY_DECIMAL_PLACES,
} from "../constants/order-money.constants";
import { MAX_ORDER_QUANTITY } from "../constants/order-create.constants";

export function parseOrderPrice(value: string): number | null {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value.trim())) return null;
  const [whole, fraction = ""] = value.trim().split(".");
  const amount =
    Number(whole) * HALALAS_PER_RIYAL +
    Number(fraction.padEnd(MONEY_DECIMAL_PLACES, "0"));
  return Number.isSafeInteger(amount) && amount <= MAX_ORDER_AMOUNT
    ? amount
    : null;
}

export function calculateOrderPreview(
  items: readonly { quantity?: number; unitPrice?: string }[],
): number | null {
  let total = 0;
  for (const item of items) {
    const price = parseOrderPrice(item.unitPrice ?? "");
    const quantity = item.quantity;
    if (
      price === null ||
      quantity === undefined ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > MAX_ORDER_QUANTITY
    )
      return null;
    total += quantity * price;
  }
  return total <= MAX_ORDER_AMOUNT ? total : null;
}
