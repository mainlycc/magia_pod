/**
 * Jedna linia do umowy/PDF/UI: pełny tekst w `street` albo klasyczny układ ulica + kod + miasto.
 */
export function formatPostalAddressLine(
  addr?: {
    street?: string | null;
    city?: string | null;
    zip?: string | null;
    postal_code?: string | null;
  } | null
): string {
  if (!addr) return "-";
  const s = (addr.street ?? "").trim();
  const z = (addr.zip ?? addr.postal_code ?? "").trim();
  const c = (addr.city ?? "").trim();
  if (s && !z && !c) return s;
  const tail = [z, c].filter(Boolean).join(" ").trim();
  if (!s && !tail) return "-";
  if (!tail) return s;
  if (!s) return tail;
  return `${s}, ${tail}`;
}
