import type { Prisma } from '../../generated/prisma/client.js';
import type {
  ORDER_LIST_SELECT,
  ORDER_SORT_DIRECTIONS,
  ORDER_SORT_FIELDS,
} from '../constants/order-query.constants.js';

export type OrderSortField = (typeof ORDER_SORT_FIELDS)[number];
export type OrderSortDirection = (typeof ORDER_SORT_DIRECTIONS)[number];
export type OrderListItem = Prisma.OrderGetPayload<{
  select: typeof ORDER_LIST_SELECT;
}>;
export interface OrderPage {
  items: OrderListItem[];
  nextCursor: string | null;
}
