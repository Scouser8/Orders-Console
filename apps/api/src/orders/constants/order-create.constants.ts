import type { Prisma } from '../../generated/prisma/client.js';
import { ORDER_LIST_SELECT } from './order-query.constants.js';

export const MAX_ORDER_NAME_LENGTH = 120;
export const MAX_ORDER_EMAIL_LENGTH = 254;
export const MAX_ORDER_ITEMS = 100;
export const MAX_ORDER_QUANTITY = 10_000;
export const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
export const CREATED_ORDER_SELECT = {
  ...ORDER_LIST_SELECT,
  items: {
    select: { id: true, name: true, quantity: true, unitPrice: true },
    orderBy: { id: 'asc' },
  },
} satisfies Prisma.OrderSelect;
export const ORDER_REPLAY_SELECT = {
  requestHash: true,
  order: { select: CREATED_ORDER_SELECT },
} satisfies Prisma.IdempotencyRecordSelect;
