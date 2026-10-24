import type { Prisma } from '../../generated/prisma/client.js';
import type {
  CREATED_ORDER_SELECT,
  ORDER_REPLAY_SELECT,
} from '../constants/order-create.constants.js';

export type CreatedOrder = Prisma.OrderGetPayload<{
  select: typeof CREATED_ORDER_SELECT;
}>;
export type OrderReplayRecord = Prisma.IdempotencyRecordGetPayload<{
  select: typeof ORDER_REPLAY_SELECT;
}>;
