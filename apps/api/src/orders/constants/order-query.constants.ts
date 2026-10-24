import type { Prisma } from '../../generated/prisma/client.js';

export const ORDER_SORT_FIELDS = ['createdAt', 'totalAmount'] as const;
export const ORDER_SORT_DIRECTIONS = ['asc', 'desc'] as const;
export const DEFAULT_ORDER_PAGE_SIZE = 50;
export const MAX_ORDER_PAGE_SIZE = 100;
export const MAX_ORDER_SEARCH_LENGTH = 254;
export const MAX_ORDER_CURSOR_LENGTH = 2048;
export const MAX_ORDER_AMOUNT = 2_147_483_647;
export const ORDER_LIST_SELECT = {
  id: true,
  customerName: true,
  customerEmail: true,
  status: true,
  totalAmount: true,
  createdAt: true,
} satisfies Prisma.OrderSelect;
