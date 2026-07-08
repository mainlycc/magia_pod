/**
 * Sumuje dopłaty za diety, ubezpieczenia i atrakcje z pola selected_services uczestników.
 * Logika zgodna z generowaniem PDF (baza × osoby + dopłaty).
 */
export type ParticipantLike = {
  selected_services?: unknown;
};

/** Płaska lista usług z formularza rezerwacji (`participant_services`). */
export type FormParticipantServiceLike = {
  type?: string;
  price_cents?: number | null;
  currency?: string | null;
  include_in_contract?: boolean;
};

type ServiceCatalogsLike = {
  form_diets?: unknown;
  form_extra_insurances?: unknown;
  form_additional_attractions?: unknown;
};

function resolveCatalogPriceCents(params: {
  type?: string;
  service_id?: string;
  variant_id?: string;
  catalogs?: ServiceCatalogsLike | null;
}): number {
  const { type, service_id, variant_id, catalogs } = params;
  if (!catalogs || !type || !service_id) return 0;

  try {
    if (type === "diet") {
      const diets = Array.isArray(catalogs.form_diets) ? (catalogs.form_diets as any[]) : [];
      const diet = diets.find((d) => d?.id === service_id);
      const variants = Array.isArray(diet?.variants) ? diet.variants : [];
      const variant = variant_id ? variants.find((v: any) => v?.id === variant_id) : null;
      const cents = (variant?.price_cents ?? diet?.price_cents) as unknown;
      return typeof cents === "number" && Number.isFinite(cents) ? Math.round(cents) : 0;
    }

    if (type === "insurance") {
      const ins = Array.isArray(catalogs.form_extra_insurances)
        ? (catalogs.form_extra_insurances as any[])
        : [];
      const insurance = ins.find((i) => i?.id === service_id);
      const variants = Array.isArray(insurance?.variants) ? insurance.variants : [];
      const variant = variant_id ? variants.find((v: any) => v?.id === variant_id) : null;
      const cents = (variant?.price_cents ?? insurance?.price_cents) as unknown;
      return typeof cents === "number" && Number.isFinite(cents) ? Math.round(cents) : 0;
    }

    if (type === "attraction") {
      const attrs = Array.isArray(catalogs.form_additional_attractions)
        ? (catalogs.form_additional_attractions as any[])
        : [];
      const attraction = attrs.find((a) => a?.id === service_id);
      const cents = (attraction?.price_cents ?? 0) as unknown;
      return typeof cents === "number" && Number.isFinite(cents) ? Math.round(cents) : 0;
    }
  } catch {
    // ignore
  }

  return 0;
}

/**
 * Sumuje dopłaty na podstawie `selected_services` i katalogów z wycieczki,
 * nawet jeśli w `selected_services` nie ma `price_cents` (np. stare dane).
 */
export function sumAdditionalServicesCentsUsingCatalogs(
  participants: readonly ParticipantLike[],
  catalogs: ServiceCatalogsLike | null | undefined,
): number {
  let sum = 0;
  if (!participants?.length) return 0;

  for (const p of participants) {
    const s = p.selected_services;
    if (!s || typeof s !== "object") continue;
    const o = s as Record<string, unknown>;

    const diets = Array.isArray(o.diets) ? (o.diets as Array<Record<string, unknown>>) : [];
    const insurances = Array.isArray(o.insurances) ? (o.insurances as Array<Record<string, unknown>>) : [];
    const attractions = Array.isArray(o.attractions) ? (o.attractions as Array<Record<string, unknown>>) : [];

    for (const d of diets) {
      const centsRaw = d.price_cents;
      let cents =
        typeof centsRaw === "number" && Number.isFinite(centsRaw) && centsRaw > 0
          ? Math.round(centsRaw)
          : 0;
      if (!cents) {
        cents = resolveCatalogPriceCents({
          type: "diet",
          service_id: typeof d.service_id === "string" ? d.service_id : undefined,
          variant_id: typeof d.variant_id === "string" ? d.variant_id : undefined,
          catalogs: catalogs ?? null,
        });
      }
      if (cents > 0) sum += cents;
    }

    for (const ins of insurances) {
      const centsRaw = ins.price_cents;
      let cents =
        typeof centsRaw === "number" && Number.isFinite(centsRaw) && centsRaw > 0
          ? Math.round(centsRaw)
          : 0;
      if (!cents) {
        cents = resolveCatalogPriceCents({
          type: "insurance",
          service_id: typeof ins.service_id === "string" ? ins.service_id : undefined,
          variant_id: typeof ins.variant_id === "string" ? ins.variant_id : undefined,
          catalogs: catalogs ?? null,
        });
      }
      if (cents > 0) sum += cents;
    }

    for (const a of attractions) {
      if (a.include_in_contract === false) continue;
      const currency = typeof a.currency === "string" ? a.currency : "PLN";
      if (currency && currency !== "PLN") continue;

      const centsRaw = a.price_cents;
      let cents =
        typeof centsRaw === "number" && Number.isFinite(centsRaw) && centsRaw > 0
          ? Math.round(centsRaw)
          : 0;
      if (!cents) {
        cents = resolveCatalogPriceCents({
          type: "attraction",
          service_id: typeof a.service_id === "string" ? a.service_id : undefined,
          catalogs: catalogs ?? null,
        });
      }
      if (cents > 0) sum += cents;
    }
  }

  return sum;
}

/** Sumuje dopłaty z tablicy `participant_services` (jak w podsumowaniu formularza). */
export function sumFormParticipantServicesCents(
  services: readonly FormParticipantServiceLike[] | undefined | null,
): number {
  if (!services?.length) return 0;

  let sum = 0;
  for (const service of services) {
    if (service.currency && service.currency !== "PLN") continue;
    if (service.type === "attraction" && service.include_in_contract === false) continue;
    const cents = service.price_cents;
    if (typeof cents === "number" && Number.isFinite(cents) && cents > 0) {
      sum += Math.round(cents);
    }
  }
  return sum;
}

/**
 * Wybiera sumę dopłat: jawna wartość, selected_services uczestników lub participant_services z formularza.
 * Math.max między źródłami uczestników i formularza — bez podwójnego liczenia przy pełnych danych.
 */
export function resolveAdditionalServicesCents(
  participants?: readonly ParticipantLike[],
  participantServices?: readonly FormParticipantServiceLike[],
  explicitAddonTotalCents?: number | null,
): number {
  if (typeof explicitAddonTotalCents === "number" && Number.isFinite(explicitAddonTotalCents)) {
    return Math.round(explicitAddonTotalCents);
  }

  const fromParticipants = participants?.length ? sumAdditionalServicesCents(participants) : 0;
  const fromForm = sumFormParticipantServicesCents(participantServices);
  return Math.max(fromParticipants, fromForm);
}

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
