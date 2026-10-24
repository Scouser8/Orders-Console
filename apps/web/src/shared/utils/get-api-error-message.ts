export function getApiErrorMessage(body: unknown, fallback: string): string {
  if (typeof body !== "object" || body === null || !("message" in body)) {
    return fallback;
  }

  if (typeof body.message === "string" && body.message.trim()) {
    return body.message;
  }

  if (Array.isArray(body.message)) {
    const messages = body.message.filter(
      (message): message is string =>
        typeof message === "string" && message.trim().length > 0,
    );
    if (messages.length > 0) return messages.join("; ");
  }

  return fallback;
}
