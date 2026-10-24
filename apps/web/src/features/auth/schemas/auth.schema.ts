import { z } from "zod";
import {
  AUTH_ROLES,
  LOGIN_MAX_EMAIL_LENGTH,
  LOGIN_MAX_PASSWORD_BYTES,
} from "../constants/auth.constants";

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(LOGIN_MAX_EMAIL_LENGTH)
    .pipe(z.email("Enter a valid email address.")),
  password: z
    .string()
    .min(1, "Enter your password.")
    .refine(
      (password) =>
        new TextEncoder().encode(password).length <= LOGIN_MAX_PASSWORD_BYTES,
      `Password must be at most ${LOGIN_MAX_PASSWORD_BYTES} bytes.`,
    ),
});

export const loginResponseSchema = z.object({
  accessToken: z.string().min(1),
  user: z.object({
    id: z.string().min(1),
    email: z.email(),
    role: z.enum(AUTH_ROLES),
  }),
});

export const tokenExpirySchema = z.object({ exp: z.number().int().positive() });
