/**
 * Normalizuje publiczny URL aplikacji (bez końcowego slasha).
 * W development zawsze origin z requestu — inaczej Paynow wraca na produkcję zamiast localhost.
 */
export function resolvePublicBaseUrl(origin?: string): string {
  const isDev = process.env.NODE_ENV === "development";

  if (isDev && origin) {
    return origin.replace(/\/$/, "");
  }

  let baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    null;

  if (!baseUrl && process.env.VERCEL_URL) {
    baseUrl = `https://${process.env.VERCEL_URL}`;
  }

  if (!baseUrl && origin) {
    baseUrl = origin;
  }

  if (!baseUrl) {
    baseUrl = "http://localhost:3000";
  }

  return baseUrl.replace(/\/$/, "");
}
