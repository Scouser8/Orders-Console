import { apiRequest } from "../../../shared/api/api-client";
import { createdOrderSchema } from "../schemas/create-order.schema";
import type {
  CreatedOrder,
  OrderSubmission,
} from "../types/order-create.types";

export async function createOrder(
  submission: OrderSubmission,
  accessToken: string,
  signal: AbortSignal,
): Promise<CreatedOrder> {
  const result = await apiRequest<unknown>("/orders", {
    method: "POST",
    body: submission.payload,
    accessToken,
    signal,
    headers: { "Idempotency-Key": submission.key },
  });
  signal.throwIfAborted();
  return createdOrderSchema.parse(result);
}
