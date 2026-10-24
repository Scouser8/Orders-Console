import { API_BASE_PATH } from "../constants/api.constants";
import type { ApiRequestOptions } from "../types/api.types";
import { getApiErrorMessage } from "../utils/get-api-error-message";
import { ApiError } from "./api-error";

export async function apiRequest<TResponse>(
  path: `/${string}`,
  options: ApiRequestOptions = {},
): Promise<TResponse> {
  const { body, accessToken, ...init } = options;
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (body !== undefined) headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  const response = await fetch(`${API_BASE_PATH}${path}`, {
    ...init,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    let errorBody: unknown;
    try {
      errorBody = JSON.parse(text);
    } catch {
      errorBody = undefined;
    }
    throw new ApiError(
      response.status,
      getApiErrorMessage(errorBody, `Request failed (${response.status})`),
    );
  }

  if (response.status === 204) return undefined as TResponse;
  return response.json() as Promise<TResponse>;
}
