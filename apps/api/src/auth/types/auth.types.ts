import type { Request } from 'express';
import type { User } from '../../generated/prisma/client.js';

export type AuthenticatedUser = Pick<User, 'id' | 'email' | 'role'>;

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthenticatedUser;
}
