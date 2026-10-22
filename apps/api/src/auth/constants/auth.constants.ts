import type { Prisma } from '../../generated/prisma/client.js';

export const JWT_ALGORITHM = 'HS256';
export const JWT_EXPIRES_IN_SECONDS = 60 * 60;
export const JWT_MIN_SECRET_BYTES = 32;
export const LOGIN_MAX_EMAIL_LENGTH = 254;
export const LOGIN_MAX_PASSWORD_BYTES = 72;
export const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password';

export const AUTH_USER_SELECT = {
  id: true,
  email: true,
  role: true,
} satisfies Prisma.UserSelect;
