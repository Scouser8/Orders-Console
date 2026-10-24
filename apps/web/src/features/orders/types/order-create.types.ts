import type { z } from "zod";
import type { Control, FieldErrors, UseFormRegister } from "react-hook-form";
import type {
  createdOrderSchema,
  createOrderFormSchema,
} from "../schemas/create-order.schema";

export type CreateOrderFormValues = z.input<typeof createOrderFormSchema>;
export type CreateOrderPayload = z.output<typeof createOrderFormSchema>;
export type CreatedOrder = z.infer<typeof createdOrderSchema>;
export interface CreateOrderFormProps {
  onCreated?: (order: CreatedOrder) => void;
}
export interface OrderSubmission {
  key: string;
  payload: CreateOrderPayload;
}
export interface OrderItemFieldsProps {
  index: number;
  register: UseFormRegister<CreateOrderFormValues>;
  errors: FieldErrors<CreateOrderFormValues>;
  canRemove: boolean;
  onRemove: () => void;
}
export interface OrderTotalProps {
  control: Control<CreateOrderFormValues, unknown, CreateOrderPayload>;
}
