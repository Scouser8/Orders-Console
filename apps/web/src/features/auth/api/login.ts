import { apiRequest } from "../../../shared/api/api-client";
import type { LoginCredentials } from "../types/auth.types";
import { createAuthSession } from "../utils/create-auth-session";

export async function login(
  credentials: LoginCredentials,
  signal?: AbortSignal,
) {
  const response = await apiRequest<unknown>("/auth/login", {
    method: "POST",
    body: credentials,
    signal,
  });
  return createAuthSession(response);
}
