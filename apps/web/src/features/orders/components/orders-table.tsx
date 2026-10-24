import { useMemo } from "react";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { ORDER_COLUMNS } from "../constants/order-columns";
import { useOrders } from "../hooks/use-orders";
import { useOrderTableState } from "../hooks/use-order-table-state";
import { OrderControls } from "./order-controls";
import { OrderResults } from "./order-results";

export function OrdersTable() {
  const { query: filters, ...tableState } = useOrderTableState();
  const query = useOrders(filters);
  const data = useMemo(
    () => query.data?.pages.flatMap((page) => page.items) ?? [],
    [query.data],
  );
  const table = useReactTable({
    ...tableState,
    data,
    columns: ORDER_COLUMNS,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (order) => order.id,
    manualSorting: true,
    manualFiltering: true,
    manualPagination: true,
    enableMultiSort: false,
    enableSortingRemoval: false,
  });
  return (
    <div className="mt-6">
      <OrderControls table={table} />
      {/* A different query starts at the top with a fresh virtual viewport. */}
      <OrderResults key={JSON.stringify(filters)} table={table} query={query} />
    </div>
  );
}
