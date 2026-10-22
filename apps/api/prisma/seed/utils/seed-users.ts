import { hash } from 'bcryptjs';
import type { PrismaClient } from '../../../src/generated/prisma/client.js';
import {
  SEED_PASSWORD_HASH_ROUNDS,
  SEED_USERS,
} from '../constants/seed.constants.js';

export async function seedUsers(prisma: PrismaClient) {
  for (const { password, ...user } of SEED_USERS) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: {
        ...user,
        passwordHash: await hash(password, SEED_PASSWORD_HASH_ROUNDS),
      },
    });
  }
}
