import { HALALAS_PER_RIYAL } from "../constants/order-money.constants";

const amountFormatter = new Intl.NumberFormat("en-SA", {
  style: "currency",
  currency: "SAR",
});
const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatOrderAmount(amount: number): string {
  return amountFormatter.format(amount / HALALAS_PER_RIYAL);
}
export function formatOrderDate(value: string): string {
  return dateFormatter.format(new Date(value));
}
