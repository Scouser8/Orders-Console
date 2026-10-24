import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ORDER_LIST_SELECT } from './constants/order-query.constants.js';
import type { ListOrdersDto } from './dto/list-orders.dto.js';
import type { OrderPage } from './types/order-query.types.js';
import { cursorWhere, encodeOrderCursor } from './utils/order-cursor.js';

@Injectable()
export class OrdersService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

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
