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
import { Role } from '../src/generated/prisma/enums.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('order deletion authorization', () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  let jwt: JwtService;
  let directory: string;
  let adminId: string;
  let agentId: string;
  let adminToken: string;
  let agentToken: string;
  let orderId: string;
  let idempotencyKey: string;

  beforeAll(async () => {
    directory = mkdtempSync(join(tmpdir(), 'sarh-order-authorization-'));
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
    await app.init();
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
    await seedUsers(prisma);

    const admin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: 'DemoAdmin123!' })
      .expect(200);
    const agent = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'agent@example.com', password: 'DemoAgent123!' })
      .expect(200);
    adminId = admin.body.user.id;
    agentId = agent.body.user.id;
    adminToken = admin.body.accessToken;
    agentToken = agent.body.accessToken;
  }, 60_000);

  beforeEach(async () => {
    idempotencyKey = randomUUID();
    const order = await prisma.order.create({
      data: {
        customerName: 'Test Customer',
        customerEmail: 'customer@example.com',
        totalAmount: 1000,
        items: { create: { name: 'Test Item', quantity: 2, unitPrice: 500 } },
        idempotencyRecord: {
          create: {
            userId: agentId,
            key: idempotencyKey,
            requestHash: 'test-request-hash',
          },
        },
      },
    });
    orderId = order.id;
  });

  afterEach(async () => {
    await prisma.idempotencyRecord.deleteMany();
    await prisma.order.deleteMany();
  });

  afterAll(async () => {
    await app?.close();
    if (directory) rmSync(directory, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  async function expectOrderUnchanged() {
    expect(
      await prisma.order.findUnique({ where: { id: orderId } }),
    ).not.toBeNull();
    expect(await prisma.orderItem.count({ where: { orderId } })).toBe(1);
    expect(
      await prisma.idempotencyRecord.findUnique({
        where: { userId_key: { userId: agentId, key: idempotencyKey } },
      }),
    ).toMatchObject({ orderId });
  }

  it.each([undefined, 'Bearer malformed', 'Basic credentials'])(
    'rejects unauthenticated deletion: %s',
    async (header) => {
      const req = request(app.getHttpServer()).delete(`/api/orders/${orderId}`);
      if (header) req.set('Authorization', header);
      await req.expect(401);
      await expectOrderUnchanged();
    },
  );

  it('rejects query-string authentication', async () => {
    await request(app.getHttpServer())
      .delete(`/api/orders/${orderId}`)
      .query({ token: adminToken })
      .expect(401);
    await expectOrderUnchanged();
  });

  it.each(['expired', 'forged'])('rejects an %s admin token', async (kind) => {
    const token = await jwt.signAsync(
      { sub: adminId },
      kind === 'expired'
        ? { expiresIn: -1 }
        : { secret: randomBytes(32).toString('hex') },
    );
    await request(app.getHttpServer())
      .delete(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
    await expectOrderUnchanged();
  });

  it('denies agents without changing the order', async () => {
    await request(app.getHttpServer())
      .delete(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${agentToken}`)
      .expect(403);
    await expectOrderUnchanged();
  });

  it('does not reveal order existence to agents', async () => {
    await request(app.getHttpServer())
      .delete('/api/orders/missing-order')
      .set('Authorization', `Bearer ${agentToken}`)
      .expect(403);
    await expectOrderUnchanged();
  });

  it('ignores a token-supplied admin role for an agent', async () => {
    const token = await jwt.signAsync({ sub: agentId, role: 'ADMIN' });
    await request(app.getHttpServer())
      .delete(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
    await expectOrderUnchanged();
  });

  it('uses a changed database role immediately', async () => {
    await prisma.user.update({
      where: { id: adminId },
      data: { role: Role.AGENT },
    });
    try {
      await request(app.getHttpServer())
        .delete(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(403);
      await expectOrderUnchanged();
    } finally {
      await prisma.user.update({
        where: { id: adminId },
        data: { role: Role.ADMIN },
      });
    }
  });

  it('lets admins delete only the requested order and retains its idempotency key', async () => {
    const other = await prisma.order.create({
      data: {
        customerName: 'Other Customer',
        customerEmail: 'other@example.com',
        totalAmount: 0,
      },
    });
    await request(app.getHttpServer())
      .delete(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200, { ok: true });
    expect(
      await prisma.order.findUnique({ where: { id: orderId } }),
    ).toBeNull();
    expect(await prisma.orderItem.count({ where: { orderId } })).toBe(0);
    expect(
      await prisma.order.findUnique({ where: { id: other.id } }),
    ).not.toBeNull();
    expect(
      await prisma.idempotencyRecord.findUnique({
        where: { userId_key: { userId: agentId, key: idempotencyKey } },
      }),
    ).toMatchObject({ orderId: null, requestHash: 'test-request-hash' });
  });

  it('returns 404 for a missing order', async () => {
    const response = await request(app.getHttpServer())
      .delete('/api/orders/missing-order')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
    expect(response.body.message).toBe('Order not found');
    await expectOrderUnchanged();
  });

  it('returns 404 on repeated deletion without removing the retained key', async () => {
    await request(app.getHttpServer())
      .delete(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .delete(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
    expect(
      await prisma.idempotencyRecord.count({
        where: { userId: agentId, key: idempotencyKey },
      }),
    ).toBe(1);
  });
});
