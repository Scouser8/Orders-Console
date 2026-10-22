import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  AUTH_USER_SELECT,
  INVALID_CREDENTIALS_MESSAGE,
} from './constants/auth.constants.js';
import type { LoginDto } from './dto/login.dto.js';
import type { AuthenticatedUser, LoginResponse } from './types/auth.types.js';

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JwtService) private readonly jwt: JwtService,
  ) {}

  async login({ email, password }: LoginDto): Promise<LoginResponse> {
    const account = await this.prisma.user.findUnique({
      where: { email },
      select: { ...AUTH_USER_SELECT, passwordHash: true },
    });

    if (!account || !(await compare(password, account.passwordHash))) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    const user = { id: account.id, email: account.email, role: account.role };
    const accessToken = await this.jwt.signAsync({ sub: user.id });
    return { accessToken, user };
  }

  async authenticateToken(token: string): Promise<AuthenticatedUser> {
    let payload: Record<string, unknown>;
    try {
      payload = await this.jwt.verifyAsync<Record<string, unknown>>(token);
    } catch {
      throw new UnauthorizedException();
    }

    if (
      !payload ||
      typeof payload !== 'object' ||
      typeof payload.sub !== 'string' ||
      !payload.sub ||
      typeof payload.exp !== 'number' ||
      !Number.isFinite(payload.exp)
    ) {
      throw new UnauthorizedException();
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: AUTH_USER_SELECT,
    });
    if (!user) throw new UnauthorizedException();
    return user;
  }
}
