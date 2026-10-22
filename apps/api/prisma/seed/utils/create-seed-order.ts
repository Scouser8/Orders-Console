import type { Prisma } from '../../../src/generated/prisma/client.js';
import {
  SEED_CUSTOMERS,
  SEED_DATE_INTERVAL_MS,
  SEED_FIRST_ORDER_DATE,
  SEED_MAX_ITEMS_PER_ORDER,
  SEED_MAX_QUANTITY,
  SEED_ORDER_COUNT,
  SEED_ORDER_ID_PREFIX,
  SEED_ORDERS_PER_TIMESTAMP,
  SEED_PRODUCTS,
  SEED_STATUSES,
} from '../constants/seed.constants.js';

export function createSeedOrder(index: number) {
  const orderNumber = index + 1;
  const orderId = `${SEED_ORDER_ID_PREFIX}${String(orderNumber).padStart(String(SEED_ORDER_COUNT).length, '0')}`;
  const items = Array.from(
    { length: (index % SEED_MAX_ITEMS_PER_ORDER) + 1 },
    (_, itemIndex) => {
      const product = SEED_PRODUCTS[(index + itemIndex) % SEED_PRODUCTS.length];
      return {
        id: `${orderId}-item-${itemIndex + 1}`,
        orderId,
        name: product.name,
        quantity: ((index + itemIndex) % SEED_MAX_QUANTITY) + 1,
        unitPrice: product.unitPrice,
      } satisfies Prisma.OrderItemCreateManyInput;
    },
  );

  const order = {
    id: orderId,
    customerName: SEED_CUSTOMERS[index % SEED_CUSTOMERS.length],
    customerEmail: `customer.${orderNumber}@example.com`,
    status: SEED_STATUSES[index % SEED_STATUSES.length],
    totalAmount: items.reduce(
      (total, item) => total + item.quantity * item.unitPrice,
      0,
    ),
    createdAt: new Date(
      SEED_FIRST_ORDER_DATE +
        Math.floor(index / SEED_ORDERS_PER_TIMESTAMP) * SEED_DATE_INTERVAL_MS,
    ),
  } satisfies Prisma.OrderCreateManyInput;

  return { order, items };
}
