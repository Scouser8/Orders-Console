import { useWatch } from "react-hook-form";
import type { OrderTotalProps } from "../types/order-create.types";
import { calculateOrderPreview } from "../utils/order-money";
import { formatOrderAmount } from "../utils/format-order";

export function OrderTotal({ control }: OrderTotalProps) {
  const items = useWatch({ control, name: "items" });
  const total = calculateOrderPreview(items);
  return (
    <p className="font-semibold">
      Calculated total:{" "}
      <output aria-label="Calculated total" aria-live="polite">
        {total === null ? "—" : formatOrderAmount(total)}
      </output>
    </p>
  );
}
