import type { Row, Table } from "@tanstack/react-table";
import type { RefObject } from "react";
import type { Virtualizer } from "@tanstack/react-virtual";
import type { useOrders } from "../hooks/use-orders";
import type { Order } from "./order.types";

export interface OrderTableProps {
  table: Table<Order>;
}
export interface OrderResultsProps extends OrderTableProps {
  query: ReturnType<typeof useOrders>;
  createdOrderId?: string;
  focusedOrderRef: RefObject<string | null>;
}
export interface OrdersTableProps {
  createdOrderId?: string;
}
export interface CreatedOrderFocusOptions {
  createdOrderId?: string;
  focusedOrderRef: RefObject<string | null>;
  rows: Row<Order>[];
  virtualizer: Virtualizer<HTMLDivElement, HTMLTableRowElement>;
}
