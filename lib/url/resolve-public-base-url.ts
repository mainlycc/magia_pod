/**
 * Normalizuje publiczny URL aplikacji (bez końcowego slasha).
 * Używany przy wewnętrznych fetch do /api/* na Vercel.
 */
export function resolvePublicBaseUrl(origin?: string): string {
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
