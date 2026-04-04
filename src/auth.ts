/**
 * Extract a Bearer token from an HTTP Authorization header value.
 * Returns null if the header is missing, malformed, or the token is empty.
 */
export function extractBearerToken(authHeader: string | null | undefined): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(\S+)$/i);
  return match?.[1] ?? null;
}
