import type { Table } from "@tanstack/react-table";
import type { useOrders } from "../hooks/use-orders";
import type { Order } from "./order.types";

export interface OrderTableProps {
  table: Table<Order>;
}
export interface OrderResultsProps extends OrderTableProps {
  query: ReturnType<typeof useOrders>;
}
