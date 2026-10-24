import { MILLISECONDS_PER_SECOND } from "../constants/auth.constants";
import { loginResponseSchema, tokenExpirySchema } from "../schemas/auth.schema";
import type { AuthSession } from "../types/auth.types";

export function createAuthSession(response: unknown): AuthSession {
  try {
    const session = loginResponseSchema.parse(response);
    const payload = session.accessToken.split(".")[1];
    // Read expiry for UI cleanup only; signature verification belongs to the server.
    const { exp } = tokenExpirySchema.parse(
      JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))),
    );
    const expiresAt = exp * MILLISECONDS_PER_SECOND;
    if (expiresAt <= Date.now()) throw new Error("Expired token");
    return { ...session, expiresAt };
  } catch {
    throw new Error("The server returned an invalid or expired session.");
  }
}
