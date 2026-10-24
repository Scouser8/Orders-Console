import type { CreateOrderFormValues } from "../types/order-create.types";

export const MAX_ORDER_NAME_LENGTH = 120;
export const MAX_ORDER_EMAIL_LENGTH = 254;
export const MAX_ORDER_ITEMS = 100;
export const MAX_ORDER_QUANTITY = 10_000;
export const CREATE_ORDER_TIMEOUT_MS = 30_000;
export const EMPTY_ORDER_ITEM = { name: "", quantity: 1, unitPrice: "" };
export const EMPTY_ORDER_FORM: CreateOrderFormValues = {
  customerName: "",
  customerEmail: "",
  items: [EMPTY_ORDER_ITEM],
};
