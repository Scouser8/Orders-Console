import { execSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import type { Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  Controller,
  Get,
  Req,
  UseGuards,
  type INestApplication,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { AuthModule } from '../src/auth/auth.module.js';
import { JWT_EXPIRES_IN_SECONDS } from '../src/auth/constants/auth.constants.js';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard.js';
import type {
  AuthenticatedRequest,
  AuthenticatedUser,
} from '../src/auth/types/auth.types.js';
import { Role } from '../src/generated/prisma/enums.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { seedUsers } from '../prisma/seed/utils/seed-users.js';

// Registered only by this test module; no probe route is exposed by the application.
@Controller('auth-test')
@UseGuards(JwtAuthGuard)
class AuthenticationProbeController {
  @Get()
  currentUser(@Req() req: AuthenticatedRequest) {
    return req.user;
  }
}

describe('login and JWT authentication', () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  let jwt: JwtService;
  let agent: AuthenticatedUser;
  let directory: string;

  beforeAll(async () => {
    directory = mkdtempSync(join(tmpdir(), 'sarh-auth-'));
    vi.stubEnv(
      'DATABASE_URL',
      `file:${join(directory, 'auth.db').replaceAll('\\', '/')}`,
    );
    vi.stubEnv('JWT_SECRET', randomBytes(32).toString('hex'));
    execSync('npm run db:migrate', {
      cwd: fileURLToPath(new URL('../../../', import.meta.url)),
      env: process.env,
      timeout: 60_000,
    });

    const module = await Test.createTestingModule({
      imports: [AppModule, AuthModule],
      controllers: [AuthenticationProbeController],
    }).compile();
    app = module.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
    await seedUsers(prisma);
    agent = await prisma.user.findUniqueOrThrow({
      where: { email: 'agent@example.com' },
      select: { id: true, email: true, role: true },
    });
  }, 60_000);

  afterAll(async () => {
    await app?.close();
    if (directory) rmSync(directory, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it.each([
    { email: 'admin@example.com', password: 'DemoAdmin123!', role: 'ADMIN' },
    { email: 'agent@example.com', password: 'DemoAgent123!', role: 'AGENT' },
  ])(
    'logs in $role with a signed expiring token and no password hash',
    async ({ email, password, role }) => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email, password })
        .expect(200);
      expect(response.body.user).toEqual({
        id: expect.any(String),
        email,
        role,
      });
      expect(response.body).not.toHaveProperty('passwordHash');
      expect(response.body.user).not.toHaveProperty('passwordHash');

      const payload = await jwt.verifyAsync<{
        sub: string;
        iat: number;
        exp: number;
      }>(response.body.accessToken);
      expect(payload.sub).toBe(response.body.user.id);
      expect(payload.exp - payload.iat).toBe(JWT_EXPIRES_IN_SECONDS);
      await request(app.getHttpServer())
        .get('/auth-test')
        .set('Authorization', `Bearer ${response.body.accessToken}`)
        .expect(200, response.body.user);
    },
  );

  it('normalizes email casing and surrounding spaces', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: ' AGENT@EXAMPLE.COM ', password: 'DemoAgent123!' })
      .expect(200);
  });

  it('uses the same error for incorrect passwords and unknown users', async () => {
    const incorrect = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'agent@example.com', password: 'incorrect-password' })
      .expect(401);
    const unknown = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'missing@example.com', password: 'incorrect-password' })
      .expect(401);
    expect(incorrect.body).toEqual(unknown.body);
    expect(incorrect.body.message).toBe('Invalid email or password');
  });

  it.each([
    {},
    { email: 'invalid-email', password: 'password' },
    { email: [], password: 'password' },
    { email: 'agent@example.com' },
    { email: 'agent@example.com', password: [] },
    { email: 'agent@example.com', password: '' },
    { email: 'agent@example.com', password: 'é'.repeat(37) },
    { email: 'agent@example.com', password: 'DemoAgent123!', role: 'ADMIN' },
  ])('rejects invalid login input %#', async (body) => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send(body)
      .expect(400);
  });

  it.each([
    undefined,
    '',
    'Basic credentials',
    'Bearer',
    'Bearer token extra',
    'Bearer malformed',
  ])('rejects missing or malformed Authorization: %s', async (header) => {
    const req = request(app.getHttpServer()).get('/auth-test');
    if (header !== undefined) req.set('Authorization', header);
    await req.expect(401);
  });

  it('ignores query-string tokens even if they are valid', async () => {
    const token = await jwt.signAsync({ sub: agent.id });
    await request(app.getHttpServer())
      .get('/auth-test')
      .query({ token })
      .expect(401);
  });

  it('rejects forged signatures', async () => {
    const token = await jwt.signAsync(
      { sub: agent.id },
      { secret: randomBytes(32).toString('hex') },
    );
    await request(app.getHttpServer())
      .get('/auth-test')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('rejects expired tokens', async () => {
    const token = await jwt.signAsync({ sub: agent.id }, { expiresIn: -1 });
    await request(app.getHttpServer())
      .get('/auth-test')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('rejects a different signing algorithm', async () => {
    const token = await jwt.signAsync(
      { sub: agent.id },
      { algorithm: 'HS384' },
    );
    await request(app.getHttpServer())
      .get('/auth-test')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('rejects unsigned tokens', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString(
      'base64url',
    );
    const payload = Buffer.from(
      JSON.stringify({
        sub: agent.id,
        exp: Math.floor(Date.now() / 1000) + 60,
      }),
    ).toString('base64url');
    await request(app.getHttpServer())
      .get('/auth-test')
      .set('Authorization', `Bearer ${header}.${payload}.`)
      .expect(401);
  });

  it('requires an expiry even on a correctly signed token', async () => {
    const token = await new JwtService({
      secret: process.env.JWT_SECRET,
    }).signAsync({ sub: agent.id });
    await request(app.getHttpServer())
      .get('/auth-test')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it.each([{}, { sub: 123 }, { sub: 'missing-user' }])(
    'rejects invalid or nonexistent subjects %#',
    async (payload) => {
      const token = await jwt.signAsync(payload);
      await request(app.getHttpServer())
        .get('/auth-test')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    },
  );

  it('uses the current database role instead of a token-supplied role', async () => {
    const token = await jwt.signAsync({ sub: agent.id, role: 'ADMIN' });
    await request(app.getHttpServer())
      .get('/auth-test')
      .set('Authorization', `Bearer ${token}`)
      .expect(200, agent);
    await prisma.user.update({
      where: { id: agent.id },
      data: { role: Role.ADMIN },
    });
    try {
      await request(app.getHttpServer())
        .get('/auth-test')
        .set('Authorization', `Bearer ${token}`)
        .expect(200, { ...agent, role: 'ADMIN' });
    } finally {
      await prisma.user.update({
        where: { id: agent.id },
        data: { role: Role.AGENT },
      });
    }
  });
});
