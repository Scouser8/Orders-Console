import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ORDER_LIST_SELECT } from './constants/order-query.constants.js';
import type { ListOrdersDto } from './dto/list-orders.dto.js';
import type { OrderPage } from './types/order-query.types.js';
import { cursorWhere, encodeOrderCursor } from './utils/order-cursor.js';
import { ORDER_REPLAY_SELECT } from './constants/order-create.constants.js';
import type { CreateOrderDto } from './dto/create-order.dto.js';
import type { CreatedOrder } from './types/order-create.types.js';
import {
  parseIdempotencyKey,
  prepareOrderRequest,
} from './utils/prepare-order-request.js';
import { resolveOrderReplay } from './utils/resolve-order-replay.js';

@Injectable()
export class OrdersService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async createOrder(
    userId: string,
    rawKey: unknown,
    dto: CreateOrderDto,
  ): Promise<CreatedOrder> {
    const key = parseIdempotencyKey(rawKey);
    const { payload, totalAmount, requestHash } = prepareOrderRequest(dto);
    const where = { userId_key: { userId, key } };
    const existing = await this.prisma.idempotencyRecord.findUnique({
      where,
      select: ORDER_REPLAY_SELECT,
    });
    if (existing) return resolveOrderReplay(existing, requestHash);
    try {
      // One nested write commits the key, order, and all items together.
      const record = await this.prisma.idempotencyRecord.create({
        data: {
          user: { connect: { id: userId } },
          key,
          requestHash,
          order: {
            create: {
              ...payload,
              totalAmount,
              items: { create: payload.items },
            },
          },
        },
        select: ORDER_REPLAY_SELECT,
      });
      return resolveOrderReplay(record, requestHash);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        // Another request can win after the read; database uniqueness decides.
        const winner = await this.prisma.idempotencyRecord.findUnique({
          where,
          select: ORDER_REPLAY_SELECT,
        });
        if (winner) return resolveOrderReplay(winner, requestHash);
      }
      throw error;
    }
  }

  async listOrders(query: ListOrdersDto): Promise<OrderPage> {
    const cursor = cursorWhere(query);
    const rows = await this.prisma.order.findMany({
      where: {
        status: query.status,
        AND: [
          ...(query.search
            ? [
                {
                  OR: [
                    { customerName: { contains: query.search } },
                    { customerEmail: { contains: query.search } },
                  ],
                },
              ]
            : []),
          ...(cursor ? [cursor] : []),
        ],
      },
      orderBy: [
        { [query.sortBy]: query.sortDirection },
        { id: query.sortDirection },
      ],
      select: ORDER_LIST_SELECT,
      take: query.limit + 1,
    });
    const items = rows.slice(0, query.limit);
    const last = items.at(-1);
    return {
      items,
      nextCursor:
        rows.length > query.limit && last
          ? encodeOrderCursor(last, query)
          : null,
    };
  }

  async deleteOrder(id: string) {
    try {
      await this.prisma.order.delete({ where: { id }, select: { id: true } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('Order not found');
      }
      throw error;
    }
    return { ok: true };
  }
}
