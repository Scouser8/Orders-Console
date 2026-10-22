import { randomBytes } from 'node:crypto';
import { createJwtOptions } from './create-jwt-options.js';

afterEach(() => vi.unstubAllEnvs());

it.each([undefined, '', 'too-short', ' '.repeat(64)])(
  'rejects a missing or invalid JWT secret %#',
  (secret) => {
    vi.stubEnv('JWT_SECRET', secret);
    expect(() => createJwtOptions()).toThrow(
      'JWT_SECRET must contain at least 32 bytes',
    );
  },
);

it('uses the supplied secret for signing and verification', () => {
  const secret = randomBytes(32).toString('hex');
  vi.stubEnv('JWT_SECRET', secret);
  expect(createJwtOptions().secret).toBe(secret);
});
