import { execSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import type { Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { Response } from 'supertest';
import { AppModule } from '../src/app.module.js';
import { OrderStatus, Role } from '../src/generated/prisma/enums.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const fixtures = Array.from({ length: 105 }, (_, index) => ({
  id: `order-${String(index).padStart(3, '0')}`,
  customerName: index % 2 === 0 ? 'Alice Example' : 'Bob Example',
  customerEmail: `customer-${index}@example.com`,
  status: index % 3 === 0 ? OrderStatus.PENDING : OrderStatus.COMPLETED,
  totalAmount: Math.floor(index / 4) * 100,
  createdAt: new Date(Date.UTC(2026, 0, 1 + Math.floor(index / 5))),
}));

describe('protected order listing', () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  let directory: string;
  let agentToken: string;
  let adminToken: string;

  beforeAll(async () => {
    directory = mkdtempSync(join(tmpdir(), 'sarh-order-list-'));
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
    const jwt = app.get(JwtService);
    for (const role of [Role.AGENT, Role.ADMIN]) {
      const user = await prisma.user.create({
        data: {
          email: `${role}@example.com`,
          passwordHash: 'not-used-by-this-test',
          role,
        },
      });
      const token = await jwt.signAsync({ sub: user.id });
      if (role === Role.AGENT) agentToken = token;
      else adminToken = token;
    }
    await prisma.order.createMany({ data: fixtures });
  }, 60_000);

  afterAll(async () => {
    await app?.close();
    if (directory) rmSync(directory, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  function list(
    query: Record<string, string | number | undefined> = {},
    token = agentToken,
  ) {
    return request(app.getHttpServer())
      .get('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .query(query);
  }

  it('requires a Bearer token, ignoring query credentials', async () => {
    await request(app.getHttpServer()).get('/api/orders').expect(401);
    await request(app.getHttpServer())
      .get('/api/orders')
      .query({ token: adminToken })
      .expect(401);
    await list({}, 'malformed').expect(401);
  });

  it('allows both roles and bounds default/maximum pages without item details', async () => {
    for (const token of [agentToken, adminToken]) {
      const response = await list({}, token).expect(200);
      expect(response.body.items).toHaveLength(50);
      expect(response.body.nextCursor).toEqual(expect.any(String));
      expect(Object.keys(response.body.items[0]).sort()).toEqual([
        'createdAt',
        'customerEmail',
        'customerName',
        'id',
        'status',
        'totalAmount',
      ]);
    }
    expect((await list({ limit: 100 }).expect(200)).body.items).toHaveLength(
      100,
    );
  });

  it('searches name/email and combines status filtering', async () => {
    const response: Response = await list({
      search: '  ALICE  ',
      status: 'PENDING',
      limit: 100,
    }).expect(200);
    expect(
      response.body.items.map((item: { id: string }) => item.id).sort(),
    ).toEqual(
      fixtures
        .filter(
          (item) =>
            item.customerName.startsWith('Alice') && item.status === 'PENDING',
        )
        .map((item) => item.id),
    );
    const email = await list({ search: 'customer-103@' }).expect(200);
    expect(email.body.items.map((item: { id: string }) => item.id)).toEqual([
      'order-103',
    ]);
    expect(email.body.nextCursor).toBeNull();
    expect((await list({ search: 'no match' }).expect(200)).body).toEqual({
      items: [],
      nextCursor: null,
    });
  });

  it.each([
    ['createdAt', 'asc'],
    ['createdAt', 'desc'],
    ['totalAmount', 'asc'],
    ['totalAmount', 'desc'],
  ] as const)(
    'paginates tied %s values %s without gaps or repeats',
    async (sortBy, sortDirection) => {
      const expected = [...fixtures]
        .sort((a, b) => {
          const delta =
            Number(a[sortBy]) - Number(b[sortBy]) || a.id.localeCompare(b.id);
          return sortDirection === 'asc' ? delta : -delta;
        })
        .map((item) => item.id);
      const ids: string[] = [];
      let cursor: string | null = null;
      do {
        const response: Response = await list({
          sortBy,
          sortDirection,
          limit: 17,
          ...(cursor ? { cursor } : {}),
        }).expect(200);
        ids.push(...response.body.items.map((item: { id: string }) => item.id));
        cursor = response.body.nextCursor;
        expect(ids.length).toBeLessThanOrEqual(fixtures.length);
      } while (cursor);
      expect(ids).toEqual(expected);
    },
  );

  it.each([
    { limit: 0 },
    { limit: 101 },
    { limit: 1.5 },
    { limit: 'abc' },
    { status: 'unknown' },
    { sortBy: 'id' },
    { sortDirection: 'sideways' },
    { cursor: 'bad' },
    { cursor: '' },
    { search: 'a'.repeat(255) },
    { unknown: 'value' },
  ])('rejects invalid query %j', async (query) => {
    await list(query).expect(400);
  });

  it('rejects a cursor reused for different search, status, or sorting', async () => {
    const { body } = await list({ limit: 1 }).expect(200);
    for (const changed of [
      { search: 'Alice' },
      { status: 'PENDING' },
      { sortBy: 'totalAmount' },
      { sortDirection: 'asc' },
    ])
      await list({ ...changed, cursor: body.nextCursor }).expect(400);
  });

  it('continues from sort values even after the anchor order is deleted', async () => {
    const { body } = await list({ sortDirection: 'asc', limit: 1 }).expect(200);
    const anchor = body.items[0].id as string;
    await prisma.order.delete({ where: { id: anchor } });
    try {
      const next = await list({
        sortDirection: 'asc',
        limit: 1,
        cursor: body.nextCursor,
      }).expect(200);
      expect(next.body.items[0].id).toBe('order-001');
    } finally {
      await prisma.order.create({ data: fixtures[0]! });
    }
  });
});
