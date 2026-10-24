import { useState } from "react";
import type { ColumnFiltersState, SortingState } from "@tanstack/react-table";
import {
  DEFAULT_ORDER_QUERY,
  ORDER_STATUSES,
} from "../constants/order.constants";
import { ORDER_STATUS_COLUMN_ID } from "../constants/order-filter.constants";
import type { OrderQuery } from "../types/order.types";

export function useOrderTableState() {
  const [sorting, setSorting] = useState<SortingState>([
    {
      id: DEFAULT_ORDER_QUERY.sortBy,
      desc: DEFAULT_ORDER_QUERY.sortDirection === "desc",
    },
  ]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState(DEFAULT_ORDER_QUERY.search);
  const status = columnFilters.find(
    (filter) => filter.id === ORDER_STATUS_COLUMN_ID,
  )?.value;
  const query: OrderQuery = {
    search: globalFilter.trim(),
    status: ORDER_STATUSES.find((value) => value === status) ?? "",
    sortBy: sorting[0]?.id === "totalAmount" ? "totalAmount" : "createdAt",
    sortDirection: sorting[0]?.desc ? "desc" : "asc",
  };
  return {
    query,
    state: { sorting, columnFilters, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
  };
}
