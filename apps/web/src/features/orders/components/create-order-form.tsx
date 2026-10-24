import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import { ApiError } from "../../../shared/api/api-error";
import { Button } from "../../../shared/components/ui/button";
import { TextField } from "../../../shared/components/ui/text-field";
import {
  EMPTY_ORDER_FORM,
  EMPTY_ORDER_ITEM,
  MAX_ORDER_EMAIL_LENGTH,
  MAX_ORDER_ITEMS,
  MAX_ORDER_NAME_LENGTH,
} from "../constants/order-create.constants";
import { useCreateOrder } from "../hooks/use-create-order";
import { createOrderFormSchema } from "../schemas/create-order.schema";
import type {
  CreateOrderFormValues,
  CreateOrderFormProps,
  CreateOrderPayload,
} from "../types/order-create.types";
import { formatOrderAmount } from "../utils/format-order";
import { OrderItemFields } from "./order-item-fields";
import { OrderTotal } from "./order-total";

export function CreateOrderForm({ onCreated }: CreateOrderFormProps) {
  const mutation = useCreateOrder(onCreated);
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<CreateOrderFormValues, unknown, CreateOrderPayload>({
    resolver: zodResolver(createOrderFormSchema),
    defaultValues: EMPTY_ORDER_FORM,
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  return (
    <section
      className="mt-8 rounded-lg border border-slate-200 bg-white p-5"
      aria-labelledby="create-order-heading"
    >
      <h2 id="create-order-heading" className="mb-4 text-xl font-semibold">
        Create order
      </h2>
      <form
        noValidate
        onSubmit={handleSubmit(mutation.submit)}
        className="flex flex-col gap-4"
      >
        <fieldset
          disabled={mutation.locked}
          className="flex flex-col gap-4 disabled:opacity-70"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Customer name"
              autoComplete="name"
              maxLength={MAX_ORDER_NAME_LENGTH}
              error={errors.customerName?.message}
              {...register("customerName")}
            />
            <TextField
              label="Customer email"
              type="email"
              autoComplete="email"
              maxLength={MAX_ORDER_EMAIL_LENGTH}
              error={errors.customerEmail?.message}
              {...register("customerEmail")}
            />
          </div>
          {fields.map((field, index) => (
            <OrderItemFields
              key={field.id}
              index={index}
              register={register}
              errors={errors}
              canRemove={fields.length > 1}
              onRemove={() => remove(index)}
            />
          ))}
          <Button
            className="self-start"
            disabled={fields.length >= MAX_ORDER_ITEMS}
            onClick={() => append({ ...EMPTY_ORDER_ITEM })}
          >
            Add item
          </Button>
        </fieldset>
        {(errors.items?.root?.message || errors.items?.message) && (
          <p role="alert" className="text-sm text-red-700">
            {errors.items.root?.message ?? errors.items.message}
          </p>
        )}
        <OrderTotal control={control} />
        {mutation.isError && (
          <p role="alert" className="text-sm text-red-700">
            {mutation.error instanceof ApiError
              ? mutation.error.message
              : "The order could not be confirmed. Retry to check its result safely."}
          </p>
        )}
        {mutation.isSuccess && (
          <p role="status" className="text-sm text-green-800">
            Order {mutation.data.id} created. Saved total:{" "}
            {formatOrderAmount(mutation.data.totalAmount)}.
          </p>
        )}
        {mutation.locked && mutation.isError && !mutation.canStartNew && (
          <p className="text-sm text-slate-600">
            Keep this form open and retry the same order before starting
            another.
          </p>
        )}
        {mutation.canStartNew ? (
          <Button
            className="self-start"
            onClick={() => {
              mutation.startNew();
              reset(EMPTY_ORDER_FORM);
            }}
          >
            Create another order
          </Button>
        ) : (
          <Button
            type="submit"
            className="self-start"
            disabled={mutation.isPending}
            aria-busy={mutation.isPending}
          >
            {mutation.isPending
              ? "Creating order…"
              : mutation.locked
                ? "Retry order"
                : "Create order"}
          </Button>
        )}
      </form>
    </section>
  );
}
