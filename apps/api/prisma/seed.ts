import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { env } from 'prisma/config';
import { PrismaClient } from '../src/generated/prisma/client.js';
import {
  SEED_BATCH_SIZE,
  SEED_ORDER_COUNT,
} from './seed/constants/seed.constants.js';
import { createSeedOrder } from './seed/utils/create-seed-order.js';

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: env('DATABASE_URL') }),
});

try {
  let createdCount = 0;

  for (let offset = 0; offset < SEED_ORDER_COUNT; offset += SEED_BATCH_SIZE) {
    const batch = Array.from(
      { length: Math.min(SEED_BATCH_SIZE, SEED_ORDER_COUNT - offset) },
      (_, index) => createSeedOrder(offset + index),
    );

    createdCount += await prisma.$transaction(async (tx) => {
      const existingOrders = await tx.order.findMany({
        where: { id: { in: batch.map(({ order }) => order.id) } },
        select: { id: true },
      });
      const existingIds = new Set(existingOrders.map(({ id }) => id));
      const missingOrders = batch.filter(
        ({ order }) => !existingIds.has(order.id),
      );
      if (missingOrders.length === 0) return 0;

      await tx.order.createMany({
        data: missingOrders.map(({ order }) => order),
      });
      await tx.orderItem.createMany({
        data: missingOrders.flatMap(({ items }) => items),
      });
      return missingOrders.length;
    });
  }

  console.log(
    `Added ${createdCount} demo orders; ${SEED_ORDER_COUNT - createdCount} were already present.`,
  );
} finally {
  await prisma.$disconnect();
}
