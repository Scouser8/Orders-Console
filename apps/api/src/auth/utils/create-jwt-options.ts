import type { JwtModuleOptions } from '@nestjs/jwt';
import {
  JWT_ALGORITHM,
  JWT_EXPIRES_IN_SECONDS,
  JWT_MIN_SECRET_BYTES,
} from '../constants/auth.constants.js';

export function createJwtOptions(): JwtModuleOptions {
  const secret = process.env.JWT_SECRET;
  if (
    !secret ||
    !secret.trim() ||
    Buffer.byteLength(secret) < JWT_MIN_SECRET_BYTES
  ) {
    throw new Error(
      `JWT_SECRET must contain at least ${JWT_MIN_SECRET_BYTES} bytes; generate it locally with crypto.randomBytes`,
    );
  }

  return {
    secret,
    signOptions: {
      algorithm: JWT_ALGORITHM,
      expiresIn: JWT_EXPIRES_IN_SECONDS,
    },
    verifyOptions: { algorithms: [JWT_ALGORITHM] },
  };
}
