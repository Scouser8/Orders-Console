import { createHash } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import { IDEMPOTENCY_KEY_PATTERN } from '../constants/order-create.constants.js';
import { MAX_ORDER_AMOUNT } from '../constants/order-query.constants.js';
import type { CreateOrderDto } from '../dto/create-order.dto.js';

export function parseIdempotencyKey(value: unknown): string {
  if (typeof value !== 'string' || !IDEMPOTENCY_KEY_PATTERN.test(value)) {
    throw new BadRequestException('A valid Idempotency-Key header is required');
  }
  return value;
}

export function prepareOrderRequest(dto: CreateOrderDto) {
  // Fixed property order makes JSON property ordering irrelevant to retries.
  const payload = {
    customerName: dto.customerName,
    customerEmail: dto.customerEmail,
    items: dto.items.map(({ name, quantity, unitPrice }) => ({
      name,
      quantity,
      unitPrice,
    })),
  };
  // Check with integer arithmetic before converting back to Prisma's Int range.
  const total = payload.items.reduce(
    (sum, item) => sum + BigInt(item.quantity) * BigInt(item.unitPrice),
    0n,
  );
  if (total > BigInt(MAX_ORDER_AMOUNT)) {
    throw new BadRequestException('Order total exceeds the supported amount');
  }
  return {
    payload,
    totalAmount: Number(total),
    requestHash: createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex'),
  };
}
