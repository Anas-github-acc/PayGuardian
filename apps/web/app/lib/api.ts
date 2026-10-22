export type AuthSession = { access_token: string } | null | undefined;

export function buildApiHeaders(
  session: AuthSession,
  localUserId: string | undefined,
  initHeaders?: HeadersInit,
  isProduction = process.env.NODE_ENV === "production",
): Headers {
  const headers = new Headers(initHeaders);
  if (!headers.has("content-type")) headers.set("content-type", "application/json");

  if (session?.access_token) {
    headers.set("authorization", `Bearer ${session.access_token}`);
    headers.delete("x-local-user-id");
  } else if (!isProduction && localUserId) {
    headers.set("x-local-user-id", localUserId);
  } else {
    headers.delete("x-local-user-id");
  }

  return headers;
}

export async function apiRequest<T>(
  apiBaseUrl: string,
  path: string,
  session: AuthSession,
  init: RequestInit | undefined,
  localUserId?: string,
): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: buildApiHeaders(session, localUserId, init?.headers),
  });
  const body = (await response.json()) as T & { message?: string };
  if (!response.ok) throw new Error(body.message ?? "Gateway request failed.");
  return body;
}
