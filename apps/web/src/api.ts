import { classifyStatus, type ViewFailure } from "./metrics";

export class ApiRequestError extends Error {
  readonly failure: ViewFailure;

  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
    this.failure = classifyStatus(status);
  }
}

export function apiBase(): string {
  return import.meta.env.VITE_API_BASE_URL ?? "";
}

export async function apiGet<T>(path: string, token: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiBase()}${path}`, {
      headers: { authorization: `Bearer ${token}` },
    });
  } catch {
    throw new ApiRequestError(0, "UNAVAILABLE", "The API is unavailable.");
  }
  const text = await response.text();
  const body = text ? JSON.parse(text) as { error?: { code?: string; message?: string } } : {};
  if (!response.ok) {
    throw new ApiRequestError(response.status, body.error?.code ?? "REQUEST_FAILED", body.error?.message ?? "The request failed.");
  }
  return body as T;
}
