import { type NextRequest, NextResponse } from "next/server";

function getInternalApiUrl(): string {
  return (
    process.env.INTERNAL_API_URL ||
    process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "http://127.0.0.1:3001"
  );
}

function resolveAuthHeader(request: NextRequest): { key: string; value: string } | null {
  // 1. Check existing Authorization header
  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    return { key: "authorization", value: authHeader };
  }

  // 2. Check session cookies for bearer token (httpOnly or supabase cookies)
  const cookieToken =
    request.cookies.get("sb-access-token")?.value ||
    request.cookies.get("access_token")?.value ||
    request.cookies.get("supabase-auth-token")?.value;

  if (cookieToken) {
    return { key: "authorization", value: `Bearer ${cookieToken}` };
  }

  // 3. In development or local auth mode, fall back to x-local-user-id
  const isDev =
    process.env.NODE_ENV !== "production" ||
    process.env.ENABLE_LOCAL_DEV_AUTH === "true" ||
    process.env.NEXT_PUBLIC_ENABLE_LOCAL_DEV_AUTH === "true";

  if (isDev) {
    const localUserId =
      request.headers.get("x-local-user-id") ||
      process.env.LOCAL_USER_ID ||
      process.env.NEXT_PUBLIC_LOCAL_USER_ID ||
      "local-user";
    return { key: "x-local-user-id", value: localUserId };
  }

  return null;
}

async function handleProxy(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  const { path } = await context.params;
  const joinedPath = Array.isArray(path) ? path.join("/") : "";
  const query = request.nextUrl.search;
  const targetUrl = `${getInternalApiUrl().replace(/\/$/, "")}/${joinedPath}${query}`;

  const forwardHeaders = new Headers();

  // Forward client content-type and accept headers if present
  const contentType = request.headers.get("content-type");
  if (contentType) {
    forwardHeaders.set("content-type", contentType);
  }
  const accept = request.headers.get("accept");
  if (accept) {
    forwardHeaders.set("accept", accept);
  }

  // Forward idempotency or tracking headers
  const idempotencyKey = request.headers.get("idempotency-key");
  if (idempotencyKey) {
    forwardHeaders.set("idempotency-key", idempotencyKey);
  }

  // Inject authentication header
  const auth = resolveAuthHeader(request);
  if (auth) {
    forwardHeaders.set(auth.key, auth.value);
  }

  let bodyText: string | undefined;
  if (["POST", "PUT", "PATCH"].includes(request.method.toUpperCase())) {
    try {
      const text = await request.text();
      if (text && text.trim().length > 0) {
        bodyText = text;
        if (!forwardHeaders.has("content-type")) {
          forwardHeaders.set("content-type", "application/json");
        }
      } else {
        bodyText = undefined;
        forwardHeaders.delete("content-type");
      }
    } catch {
      bodyText = undefined;
      forwardHeaders.delete("content-type");
    }
  }

  try {
    const upstreamResponse = await fetch(targetUrl, {
      method: request.method,
      headers: forwardHeaders,
      body: bodyText,
      cache: "no-store",
    });

    const responseHeaders = new Headers();
    const upstreamContentType = upstreamResponse.headers.get("content-type");
    if (upstreamContentType) {
      responseHeaders.set("content-type", upstreamContentType);
    }

    // Forward Set-Cookie header if present to maintain httpOnly sessions
    if (typeof upstreamResponse.headers.getSetCookie === "function") {
      for (const cookie of upstreamResponse.headers.getSetCookie()) {
        responseHeaders.append("set-cookie", cookie);
      }
    } else {
      const setCookie = upstreamResponse.headers.get("set-cookie");
      if (setCookie) {
        responseHeaders.set("set-cookie", setCookie);
      }
    }

    const hasNoBody = [101, 204, 205, 304].includes(upstreamResponse.status);
    const responseBody = hasNoBody ? null : await upstreamResponse.arrayBuffer();

    return new NextResponse(responseBody, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown proxy error";
    return NextResponse.json(
      {
        code: "GATEWAY_PROXY_ERROR",
        message: `Failed to proxy request to gateway: ${errorMessage}`,
        target: targetUrl,
      },
      { status: 502 },
    );
  }
}

export const GET = (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) =>
  handleProxy(req, ctx);
export const POST = (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) =>
  handleProxy(req, ctx);
export const PUT = (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) =>
  handleProxy(req, ctx);
export const PATCH = (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) =>
  handleProxy(req, ctx);
export const DELETE = (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) =>
  handleProxy(req, ctx);
