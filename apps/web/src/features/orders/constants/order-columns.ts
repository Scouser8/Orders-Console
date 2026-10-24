import type { ColumnDef } from "@tanstack/react-table";
import type { Order } from "../types/order.types";
import { formatOrderAmount, formatOrderDate } from "../utils/format-order";
import { ORDER_STATUS_LABELS } from "./order.constants";

export const ORDER_COLUMNS: ColumnDef<Order>[] = [
  { accessorKey: "id", header: "Order ID", size: 220 },
  { accessorKey: "customerName", header: "Customer", size: 180 },
  { accessorKey: "customerEmail", header: "Email", size: 250 },
  {
    accessorKey: "status",
    header: "Status",
    size: 140,
    cell: ({ row }) => ORDER_STATUS_LABELS[row.original.status],
  },
  {
    accessorKey: "totalAmount",
    header: "Total",
    size: 140,
    cell: ({ row }) => formatOrderAmount(row.original.totalAmount),
  },
  {
    accessorKey: "createdAt",
    header: "Created",
    size: 190,
    cell: ({ row }) => formatOrderDate(row.original.createdAt),
  },
];
