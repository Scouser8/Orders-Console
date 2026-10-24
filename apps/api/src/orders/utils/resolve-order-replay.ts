import { ConflictException, GoneException } from '@nestjs/common';
import type {
  CreatedOrder,
  OrderReplayRecord,
} from '../types/order-create.types.js';

export function resolveOrderReplay(
  record: OrderReplayRecord,
  requestHash: string,
): CreatedOrder {
  if (record.requestHash !== requestHash) {
    throw new ConflictException(
      'Idempotency key was already used for a different order',
    );
  }
  if (!record.order) {
    throw new GoneException('The order for this idempotency key was deleted');
  }
  return record.order;
}
