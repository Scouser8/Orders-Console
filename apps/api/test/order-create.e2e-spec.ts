import { execSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import type { Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { seedUsers } from '../prisma/seed/utils/seed-users.js';
import { AppModule } from '../src/app.module.js';
import { MAX_ORDER_AMOUNT } from '../src/orders/constants/order-query.constants.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const payload = {
  customerName: 'Test Customer',
  customerEmail: 'customer@example.com',
  items: [
    { name: 'Keyboard', quantity: 2, unitPrice: 12500 },
    { name: 'Mouse', quantity: 3, unitPrice: 2550 },
  ],
};

describe('atomic, idempotent order creation', () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  let directory: string;
  let agentToken: string;
  let adminToken: string;
  let agentId: string;

  beforeAll(async () => {
    directory = mkdtempSync(join(tmpdir(), 'sarh-order-create-'));
    vi.stubEnv(
      'DATABASE_URL',
      `file:${join(directory, 'orders.db').replaceAll('\\', '/')}`,
    );
    vi.stubEnv('JWT_SECRET', randomBytes(32).toString('hex'));
    execSync('npm run db:migrate', {
      cwd: fileURLToPath(new URL('../../../', import.meta.url)),
      env: process.env,
      timeout: 60_000,
    });
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.useLogger(false);
    await app.init();
    prisma = app.get(PrismaService);
    await seedUsers(prisma);
    for (const role of ['agent', 'admin']) {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: `${role}@example.com`,
          password: role === 'agent' ? 'DemoAgent123!' : 'DemoAdmin123!',
        })
        .expect(200);
      if (role === 'agent') {
        agentToken = response.body.accessToken;
        agentId = response.body.user.id;
      } else adminToken = response.body.accessToken;
    }
  }, 60_000);

  afterEach(async () => {
    await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS fail_item');
    await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS fail_key');
    await prisma.idempotencyRecord.deleteMany();
    await prisma.order.deleteMany();
  });
  afterAll(async () => {
    await app?.close();
    if (directory) rmSync(directory, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  function create(
    key: string = randomUUID(),
    body: object = payload,
    token = agentToken,
  ) {
    return request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key)
      .send(body);
  }
  async function counts() {
    return {
      orders: await prisma.order.count(),
      items: await prisma.orderItem.count(),
      keys: await prisma.idempotencyRecord.count(),
    };
  }

  it('allows both roles, calculates totals, and stores all items', async () => {
    for (const token of [agentToken, adminToken]) {
      const response = await create(randomUUID(), payload, token).expect(201);
      expect(response.body).toMatchObject({
        customerName: payload.customerName,
        customerEmail: payload.customerEmail,
        status: 'PENDING',
        totalAmount: 32650,
        items: payload.items.map((item) => ({
          ...item,
          id: expect.any(String),
        })),
      });
      expect(response.body).not.toHaveProperty('idempotencyRecord');
      expect(response.body).not.toHaveProperty('requestHash');
      const stored = await prisma.order.findUniqueOrThrow({
        where: { id: response.body.id },
        include: { items: true },
      });
      expect(stored.totalAmount).toBe(32650);
      expect(stored.items).toHaveLength(2);
    }
    expect(await counts()).toEqual({ orders: 2, items: 4, keys: 2 });
  });

  it('normalizes names/email and replays despite JSON property ordering', async () => {
    const key = randomUUID();
    const first = await create(key, {
      customerEmail: ' CUSTOMER@EXAMPLE.COM ',
      customerName: ' Test Customer ',
      items: payload.items.map((item) => ({
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        name: ` ${item.name} `,
      })),
    }).expect(201);
    const replay = await create(key).expect(201);
    expect(replay.body).toEqual(first.body);
    expect(await counts()).toEqual({ orders: 1, items: 2, keys: 1 });
  });

  it('creates exactly one persisted order for parallel matching requests', async () => {
    const key = randomUUID();
    const [first, second] = await Promise.all([create(key), create(key)]);
    expect([first.status, second.status]).toEqual([201, 201]);
    expect(second.body).toEqual(first.body);
    expect(await counts()).toEqual({ orders: 1, items: 2, keys: 1 });
    expect(
      await prisma.idempotencyRecord.findUniqueOrThrow({
        where: { userId_key: { userId: agentId, key } },
      }),
    ).toMatchObject({ orderId: first.body.id });
  });

  it('rejects parallel conflicting payloads without partial records', async () => {
    const key = randomUUID();
    const results = await Promise.all([
      create(key),
      create(key, { ...payload, customerName: 'Different Customer' }),
    ]);
    expect(results.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);
    expect(await counts()).toEqual({ orders: 1, items: 2, keys: 1 });
  });

  it.each([
    { ...payload, customerName: 'Different' },
    { ...payload, items: [...payload.items].reverse() },
    { ...payload, items: [{ ...payload.items[0], quantity: 1 }] },
  ])('rejects a changed payload with a used key', async (changed) => {
    const key = randomUUID();
    const original = await create(key).expect(201);
    await create(key, changed).expect(409);
    expect((await create(key).expect(201)).body).toEqual(original.body);
    expect(await counts()).toEqual({ orders: 1, items: 2, keys: 1 });
  });

  it('scopes keys to users and permits new logical submissions with new keys', async () => {
    const key = randomUUID();
    const agent = await create(key).expect(201);
    const admin = await create(key, payload, adminToken).expect(201);
    const newSubmission = await create().expect(201);
    expect(
      new Set([agent.body.id, admin.body.id, newSubmission.body.id]).size,
    ).toBe(3);
    expect(await counts()).toEqual({ orders: 3, items: 6, keys: 3 });
  });

  it('retains the key after admin deletion', async () => {
    const key = randomUUID();
    const response = await create(key).expect(201);
    await request(app.getHttpServer())
      .delete(`/api/orders/${response.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    await create(key).expect(410);
    await create(key, { ...payload, customerName: 'Changed' }).expect(409);
    expect(await counts()).toEqual({ orders: 0, items: 0, keys: 1 });
  });

  it.each([undefined, '', 'Bearer malformed', 'Basic credentials'])(
    'rejects missing/invalid authentication: %s',
    async (authorization) => {
      const req = request(app.getHttpServer())
        .post('/api/orders')
        .set('Idempotency-Key', randomUUID())
        .send(payload);
      if (authorization) req.set('Authorization', authorization);
      await req.expect(401);
      expect(await counts()).toEqual({ orders: 0, items: 0, keys: 0 });
    },
  );

  it('rejects query-only, forged, and expired credentials', async () => {
    await request(app.getHttpServer())
      .post('/api/orders')
      .query({ token: agentToken })
      .set('Idempotency-Key', randomUUID())
      .send(payload)
      .expect(401);
    const jwt = app.get(JwtService);
    for (const options of [
      { expiresIn: -1 },
      { secret: randomBytes(32).toString('hex') },
    ]) {
      const token = await jwt.signAsync({ sub: agentId }, options);
      await create(randomUUID(), payload, token).expect(401);
    }
    expect(await counts()).toEqual({ orders: 0, items: 0, keys: 0 });
  });

  it.each(['', 'bad key', 'bad,key', 'a'.repeat(129), '_leading'])(
    'rejects invalid idempotency key: %s',
    async (key) => {
      await create(key).expect(400);
      expect(await counts()).toEqual({ orders: 0, items: 0, keys: 0 });
    },
  );
  it('requires an idempotency key', async () => {
    await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${agentToken}`)
      .send(payload)
      .expect(400);
    expect(await counts()).toEqual({ orders: 0, items: 0, keys: 0 });
  });

  it.each([
    {},
    { ...payload, customerName: '  ' },
    { ...payload, customerEmail: 'invalid' },
    { ...payload, customerName: 'a'.repeat(121) },
    { ...payload, items: [] },
    { ...payload, items: Array.from({ length: 101 }, () => payload.items[0]) },
    { ...payload, items: [null] },
    { ...payload, items: [[]] },
    { ...payload, items: [{ ...payload.items[0], name: '  ' }] },
    { ...payload, items: [{ ...payload.items[0], quantity: 0 }] },
    { ...payload, items: [{ ...payload.items[0], quantity: 10001 }] },
    { ...payload, items: [{ ...payload.items[0], quantity: 1.5 }] },
    { ...payload, items: [{ ...payload.items[0], quantity: '2' }] },
    { ...payload, items: [{ ...payload.items[0], unitPrice: -1 }] },
    { ...payload, items: [{ ...payload.items[0], unitPrice: 1.5 }] },
    {
      ...payload,
      items: [{ ...payload.items[0], unitPrice: MAX_ORDER_AMOUNT + 1 }],
    },
    { ...payload, items: [{ ...payload.items[0], extra: true }] },
    { ...payload, totalAmount: 1 },
    { ...payload, status: 'COMPLETED' },
    { ...payload, userId: 'other-user' },
    {
      ...payload,
      items: [{ name: 'Overflow', quantity: 2, unitPrice: MAX_ORDER_AMOUNT }],
    },
    {
      ...payload,
      items: [
        { name: 'Maximum', quantity: 1, unitPrice: MAX_ORDER_AMOUNT },
        { name: 'Extra', quantity: 1, unitPrice: 1 },
      ],
    },
  ])('rejects invalid input without reserving a key: %#', async (body) => {
    const key = randomUUID();
    await create(key, body).expect(400);
    expect(await counts()).toEqual({ orders: 0, items: 0, keys: 0 });
    await create(key).expect(201);
  });

  it.each([0, MAX_ORDER_AMOUNT])(
    'accepts valid boundary money totals: %s',
    async (amount) => {
      const response = await create(randomUUID(), {
        ...payload,
        items: [{ name: 'Boundary', quantity: 1, unitPrice: amount }],
      }).expect(201);
      expect(response.body.totalAmount).toBe(amount);
    },
  );

  it.each(['item', 'key'])(
    'rolls back every record after a database failure at the %s write',
    async (boundary) => {
      const key = randomUUID();
      if (boundary === 'item') {
        await prisma.$executeRawUnsafe(
          `CREATE TRIGGER fail_item BEFORE INSERT ON "OrderItem" WHEN NEW.name = 'Mouse' BEGIN SELECT RAISE(ABORT, 'test item failure'); END`,
        );
      } else {
        await prisma.$executeRawUnsafe(
          `CREATE TRIGGER fail_key BEFORE INSERT ON "IdempotencyRecord" BEGIN SELECT RAISE(ABORT, 'test key failure'); END`,
        );
      }
      await create(key).expect(500);
      expect(await counts()).toEqual({ orders: 0, items: 0, keys: 0 });
      await prisma.$executeRawUnsafe(
        `DROP TRIGGER ${boundary === 'item' ? 'fail_item' : 'fail_key'}`,
      );
      await create(key).expect(201);
      expect(await counts()).toEqual({ orders: 1, items: 2, keys: 1 });
    },
  );
});
