import { execSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import type { Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { seedUsers } from '../prisma/seed/utils/seed-users.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const payload = {
  customerName: 'Duplicate Proof Customer',
  customerEmail: 'duplicate-proof@example.com',
  items: [{ name: 'Proof item', quantity: 1, unitPrice: 12500 }],
};

describe('R2 duplicate proof', () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  let directory: string;
  let agentToken: string;

  beforeAll(async () => {
    directory = mkdtempSync(join(tmpdir(), 'sarh-duplicate-proof-'));
    vi.stubEnv(
      'DATABASE_URL',
      `file:${join(directory, 'orders.db').replaceAll('\\', '/')}`,
    );
    vi.stubEnv('JWT_SECRET', randomBytes(32).toString('hex'));
    execSync('npm run db:migrate', {
      cwd: fileURLToPath(new URL('../../../', import.meta.url)),
      env: process.env,
      timeout: 60_000,
      stdio: 'ignore',
    });

    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.useLogger(false);
    await app.init();
    prisma = app.get(PrismaService);
    await seedUsers(prisma);

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'agent@example.com', password: 'DemoAgent123!' })
      .expect(200);
    agentToken = login.body.accessToken;
  }, 60_000);

  afterAll(async () => {
    await app?.close();
    if (directory) rmSync(directory, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it('persists one order for two matching authenticated requests', async () => {
    const key = randomUUID();
    const sendCreate = () =>
      request(app.getHttpServer())
        .post('/api/orders')
        .set('Authorization', `Bearer ${agentToken}`)
        .set('Idempotency-Key', key)
        .send(payload);

    const [first, second] = await Promise.all([sendCreate(), sendCreate()]);
    const counts = {
      orders: await prisma.order.count(),
      items: await prisma.orderItem.count(),
      idempotencyRecords: await prisma.idempotencyRecord.count(),
    };

    console.log('\nR2 duplicate proof');
    console.log(`- request statuses: ${first.status}, ${second.status}`);
    console.log(`- returned order IDs: ${first.body.id}, ${second.body.id}`);
    console.log(`- persisted counts: ${JSON.stringify(counts)}`);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(first.body.id).toBe(second.body.id);
    expect(counts).toEqual({
      orders: 1,
      items: 1,
      idempotencyRecords: 1,
    });
  });
});
