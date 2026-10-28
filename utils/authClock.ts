// Rebase only fresh Auth HTTP responses, never a stored session or signed JWT.
// expires_in is the lifetime returned by the auth server; expires_at is the
// SDK's local refresh timer. Server-side JWT verification remains authoritative.
export async function normalizeAuthClock(
  response: Response,
  receivedAt = Date.now(),
): Promise<Response> {
  if (
    !response.ok ||
    !response.headers.get("content-type")?.includes("application/json")
  )
    return response;
  const data = await response
    .clone()
    .json()
    .catch(() => null);
  if (
    !data ||
    typeof data.access_token !== "string" ||
    typeof data.expires_in !== "number" ||
    !Number.isFinite(data.expires_in) ||
    data.expires_in <= 0 ||
    typeof data.expires_at !== "number"
  )
    return response;
  const localExpiry = Math.floor(receivedAt / 1000) + data.expires_in;
  if (Math.abs(data.expires_at - localExpiry) < 120) return response;
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.delete("content-encoding");
  return new Response(JSON.stringify({ ...data, expires_at: localExpiry }), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
export function authClockFetch(
  projectUrl: string,
  transport: typeof fetch = fetch,
): typeof fetch {
  const authPrefix = `${projectUrl.replace(/\/$/, "")}/auth/v1/`;
  return async (input, init) => {
    const response = await transport(input, init);
    const target =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    return target.startsWith(authPrefix) &&
      (
        init?.method || (input instanceof Request ? input.method : "GET")
      ).toUpperCase() === "POST"
      ? normalizeAuthClock(response)
      : response;
  };
}
