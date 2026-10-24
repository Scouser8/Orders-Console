import { useCallback, useEffect } from "react";
import type { CreatedOrderFocusOptions } from "../types/order-table.types";

export function useCreatedOrderFocus({
  createdOrderId,
  focusedOrderRef,
  rows,
  virtualizer,
}: CreatedOrderFocusOptions) {
  useEffect(() => {
    if (!createdOrderId || focusedOrderRef.current === createdOrderId) return;
    const index = rows.findIndex((row) => row.id === createdOrderId);
    // A virtual row must be mounted before it can receive focus.
    if (index >= 0) virtualizer.scrollToIndex(index, { align: "center" });
  }, [createdOrderId, focusedOrderRef, rows, virtualizer]);

  return useCallback(
    (node: HTMLTableRowElement | null) => {
      if (
        !node ||
        !createdOrderId ||
        node.dataset.orderId !== createdOrderId ||
        focusedOrderRef.current === createdOrderId
      )
        return;
      focusedOrderRef.current = createdOrderId;
      node.focus({ preventScroll: true });
      const reducedMotion = window.matchMedia?.(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      node.scrollIntoView({
        behavior: reducedMotion ? "auto" : "smooth",
        block: "center",
        inline: "nearest",
      });
    },
    [createdOrderId, focusedOrderRef],
  );
}
