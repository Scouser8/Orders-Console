import { OrderStatus, Role } from '../../../src/generated/prisma/enums.js';

export const SEED_PASSWORD_HASH_ROUNDS = 12;
export const SEED_USERS = [
  {
    email: 'admin@example.com',
    password: 'DemoAdmin123!',
    role: Role.ADMIN,
  },
  {
    email: 'agent@example.com',
    password: 'DemoAgent123!',
    role: Role.AGENT,
  },
] as const;

export const SEED_ORDER_COUNT = 50_000;
export const SEED_BATCH_SIZE = 500;
export const SEED_ORDER_ID_PREFIX = 'seed-order-';
export const SEED_MAX_ITEMS_PER_ORDER = 5;
export const SEED_MAX_QUANTITY = 4;
export const SEED_FIRST_ORDER_DATE = Date.parse('2026-01-01T00:00:00Z');
export const SEED_DATE_INTERVAL_MS = 30 * 60 * 1000;
export const SEED_ORDERS_PER_TIMESTAMP = 5;
export const SEED_STATUSES = Object.values(OrderStatus);

export const SEED_CUSTOMERS = [
  'Ahmed Ali',
  'Mariam Hassan',
  'Omar Khaled',
  'Sara Mohamed',
  'Youssef Ibrahim',
  'Nour Adel',
] as const;

export const SEED_PRODUCTS = [
  { name: 'Notebook', unitPrice: 1500 },
  { name: 'Desk Lamp', unitPrice: 8500 },
  { name: 'Water Bottle', unitPrice: 4500 },
  { name: 'Backpack', unitPrice: 18000 },
  { name: 'USB Cable', unitPrice: 2500 },
  { name: 'Mouse Pad', unitPrice: 3500 },
] as const;
