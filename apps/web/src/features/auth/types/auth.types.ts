import type { z } from "zod";
import type { loginResponseSchema, loginSchema } from "../schemas/auth.schema";

export type LoginCredentials = z.infer<typeof loginSchema>;
export type AuthSession = z.infer<typeof loginResponseSchema> & {
  expiresAt: number;
};

export interface AuthContextValue {
  session: AuthSession | null;
  signIn: (session: AuthSession) => void;
  signOut: () => void;
}
