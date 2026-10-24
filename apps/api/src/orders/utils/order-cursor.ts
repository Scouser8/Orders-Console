import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { MAX_ORDER_AMOUNT } from '../constants/order-query.constants.js';
import type { ListOrdersDto } from '../dto/list-orders.dto.js';
import type { OrderListItem } from '../types/order-query.types.js';

function queryContext(query: ListOrdersDto): string {
  return JSON.stringify([
    query.search,
    query.status ?? null,
    query.sortBy,
    query.sortDirection,
  ]);
}

export function encodeOrderCursor(
  order: OrderListItem,
  query: ListOrdersDto,
): string {
  return Buffer.from(
    JSON.stringify({
      context: queryContext(query),
      id: order.id,
      value:
        query.sortBy === 'createdAt'
          ? order.createdAt.toISOString()
          : order.totalAmount,
    }),
  ).toString('base64url');
}

export function cursorWhere(
  query: ListOrdersDto,
): Prisma.OrderWhereInput | undefined {
  if (!query.cursor) return undefined;
  try {
    if (!/^[A-Za-z0-9_-]+$/.test(query.cursor)) throw new Error();
    const decoded: unknown = JSON.parse(
      Buffer.from(query.cursor, 'base64url').toString('utf8'),
    );
    if (
      typeof decoded !== 'object' ||
      decoded === null ||
      Array.isArray(decoded)
    )
      throw new Error();
    const cursor = decoded as Record<string, unknown>;
    if (
      cursor.context !== queryContext(query) ||
      typeof cursor.id !== 'string' ||
      !cursor.id
    )
      throw new Error();
    let value: Date | number;
    if (query.sortBy === 'createdAt') {
      if (typeof cursor.value !== 'string') throw new Error();
      value = new Date(cursor.value);
      if (
        !Number.isFinite(value.getTime()) ||
        value.toISOString() !== cursor.value
      )
        throw new Error();
    } else {
      if (
        typeof cursor.value !== 'number' ||
        !Number.isInteger(cursor.value) ||
        cursor.value < 0 ||
        cursor.value > MAX_ORDER_AMOUNT
      )
        throw new Error();
      value = cursor.value;
    }
    const comparison = query.sortDirection === 'asc' ? 'gt' : 'lt';
    return {
      // Let SQLite seek into the sort index with parameterized OR conditions.
      [query.sortBy]: {
        [query.sortDirection === 'asc' ? 'gte' : 'lte']: value,
      },
      OR: [
        { [query.sortBy]: { [comparison]: value } },
        { [query.sortBy]: value, id: { [comparison]: cursor.id } },
      ],
    };
  } catch {
    throw new BadRequestException('Invalid cursor for this query');
  }
}
