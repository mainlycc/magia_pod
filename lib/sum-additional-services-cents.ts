/**
 * Sumuje dopłaty za diety, ubezpieczenia i atrakcje z pola selected_services uczestników.
 * Logika zgodna z generowaniem PDF (baza × osoby + dopłaty).
 */
export type ParticipantLike = {
  selected_services?: unknown;
};

export function sumAdditionalServicesCents(participants: readonly ParticipantLike[]): number {
  let sum = 0;

  for (const p of participants) {
    const s = p.selected_services;
    if (!s || typeof s !== "object") continue;
    const o = s as Record<string, unknown>;

    const diets = Array.isArray(o.diets) ? (o.diets as Array<Record<string, unknown>>) : [];
    const insurances = Array.isArray(o.insurances) ? (o.insurances as Array<Record<string, unknown>>) : [];
    const attractions = Array.isArray(o.attractions) ? (o.attractions as Array<Record<string, unknown>>) : [];

    for (const d of diets) {
      const cents = d.price_cents;
      if (typeof cents === "number" && Number.isFinite(cents) && cents > 0) sum += Math.round(cents);
    }
    for (const ins of insurances) {
      const cents = ins.price_cents;
      if (typeof cents === "number" && Number.isFinite(cents) && cents > 0) sum += Math.round(cents);
    }
    for (const a of attractions) {
      if (a.include_in_contract === false) continue;
      const cents = a.price_cents;
      if (typeof cents === "number" && Number.isFinite(cents) && cents > 0) sum += Math.round(cents);
    }
  }

  return sum;
}
