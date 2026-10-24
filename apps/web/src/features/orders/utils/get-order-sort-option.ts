import type { SortingState } from "@tanstack/react-table";
import { ORDER_SORT_OPTIONS } from "../constants/order-filter.constants";

export function getOrderSortOption(sorting: SortingState) {
  const sort = sorting[0];
  return (
    ORDER_SORT_OPTIONS.find(
      (option) =>
        option.sortBy === sort?.id &&
        (option.sortDirection === "desc") === sort?.desc,
    ) ?? ORDER_SORT_OPTIONS[0]
  );
}
