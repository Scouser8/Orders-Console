import { TextField } from "../../../shared/components/ui/text-field";
import { Button } from "../../../shared/components/ui/button";
import {
  MAX_ORDER_NAME_LENGTH,
  MAX_ORDER_QUANTITY,
} from "../constants/order-create.constants";
import type { OrderItemFieldsProps } from "../types/order-create.types";

export function OrderItemFields({
  index,
  register,
  errors,
  canRemove,
  onRemove,
}: OrderItemFieldsProps) {
  const itemErrors = errors.items?.[index];
  return (
    <fieldset className="grid gap-3 rounded-md border border-slate-200 p-4 sm:grid-cols-[2fr_1fr_1fr_auto]">
      <legend className="px-1 text-sm font-medium">Item {index + 1}</legend>
      <TextField
        label="Item name"
        maxLength={MAX_ORDER_NAME_LENGTH}
        error={itemErrors?.name?.message}
        {...register(`items.${index}.name`)}
      />
      <TextField
        label="Quantity"
        type="number"
        min={1}
        max={MAX_ORDER_QUANTITY}
        step={1}
        error={itemErrors?.quantity?.message}
        {...register(`items.${index}.quantity`, { valueAsNumber: true })}
      />
      <TextField
        label="Unit price (SAR)"
        inputMode="decimal"
        placeholder="0.00"
        error={itemErrors?.unitPrice?.message}
        {...register(`items.${index}.unitPrice`)}
      />
      <Button
        className="self-end"
        disabled={!canRemove}
        onClick={onRemove}
        aria-label={`Remove item ${index + 1}`}
      >
        Remove
      </Button>
    </fieldset>
  );
}
