type CatalogItem = {
  id: string;
  title?: string;
  variants?: Array<{ id: string; title?: string }>;
};

type SelectedServiceEntry = {
  service_id?: string;
  variant_id?: string;
  title?: string;
  price_cents?: number | null;
  include_in_contract?: boolean;
};

export type ServiceCatalogs = {
  form_diets?: unknown;
  form_extra_insurances?: unknown;
  form_additional_attractions?: unknown;
};

function formatServicePrice(priceCents: number | null | undefined): string {
  if (priceCents == null || priceCents === 0) return "bezpłatna";
  return `${(priceCents / 100).toFixed(2)} zł`;
}

function buildParticipantServiceLines(
  selected: unknown,
  catalogs: ServiceCatalogs,
): string[] {
  const diets = asCatalogArray(catalogs.form_diets);
  const insurances = asCatalogArray(catalogs.form_extra_insurances);
  const attractions = asCatalogArray(catalogs.form_additional_attractions);

  if (!selected || typeof selected !== "object") return [];
  const o = selected as Record<string, unknown>;

  const lines: string[] = [];

  const dietEntries = Array.isArray(o.diets) ? (o.diets as SelectedServiceEntry[]) : [];
  const insuranceEntries = Array.isArray(o.insurances)
    ? (o.insurances as SelectedServiceEntry[])
    : [];
  const attractionEntries = Array.isArray(o.attractions)
    ? (o.attractions as SelectedServiceEntry[])
    : [];

  for (const d of dietEntries) {
    const title =
      d.title?.trim() ||
      (d.service_id ? resolveCatalogTitle(diets, d.service_id, d.variant_id) : null);
    if (title) lines.push(`${title} - ${formatServicePrice(d.price_cents)}`);
  }

  for (const ins of insuranceEntries) {
    const title =
      ins.title?.trim() ||
      (ins.service_id
        ? resolveCatalogTitle(insurances, ins.service_id, ins.variant_id)
        : null);
    if (title) lines.push(`${title} - ${formatServicePrice(ins.price_cents)}`);
  }

  for (const a of attractionEntries) {
    if (a.include_in_contract === false) continue;
    const title =
      a.title?.trim() ||
      (a.service_id ? resolveCatalogTitle(attractions, a.service_id, a.variant_id) : null);
    if (title) lines.push(`${title} - ${formatServicePrice(a.price_cents)}`);
  }

  return lines;
}

/**
 * Formatuje usługi dodatkowe pogrupowane per uczestnik dla rubryki umowy.
 * Etykiety: „Uczestnik 1”, „Uczestnik 2”, …
 * Gdy brak usług u wszystkich uczestników — zwraca „brak”.
 */
export function formatSelectedServicesPerParticipant(
  participants: ParticipantWithServices[],
  catalogs: ServiceCatalogs,
): string {
  if (participants.length === 0) return "brak";

  const sections: string[] = [];
  let hasAnyService = false;

  for (let index = 0; index < participants.length; index++) {
    const lines = buildParticipantServiceLines(participants[index].selected_services, catalogs);
    if (lines.length > 0) hasAnyService = true;
    sections.push([`Uczestnik ${index + 1}`, ...lines].join("\n"));
  }

  if (!hasAnyService) return "brak";

  return sections.join("\n\n");
}

type ParticipantWithServices = {
  selected_services?: unknown;
};

function asCatalogArray(raw: unknown): CatalogItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is CatalogItem =>
      Boolean(item) && typeof item === "object" && typeof (item as CatalogItem).id === "string",
  );
}

function resolveCatalogTitle(
  catalog: CatalogItem[],
  serviceId: string,
  variantId?: string,
): string | null {
  const item = catalog.find((entry) => entry.id === serviceId);
  if (!item) return null;

  if (variantId && Array.isArray(item.variants)) {
    const variant = item.variants.find((v) => v.id === variantId);
    if (variant?.title?.trim()) return variant.title.trim();
  }

  return item.title?.trim() || null;
}

function pushUnique(
  out: Array<{ service_type?: string; service_title?: string }>,
  seen: Set<string>,
  serviceType: string,
  title: string,
) {
  const key = `${serviceType}:${title}`;
  if (!title || seen.has(key)) return;
  seen.add(key);
  out.push({ service_type: serviceType, service_title: title });
}

/**
 * Buduje listę usług dodatkowych z selected_services uczestników,
 * rozwiązując tytuły po ID z konfiguracji wycieczki.
 */
export function buildParticipantServicesFromCatalog(
  participants: ParticipantWithServices[],
  catalogs: {
    form_diets?: unknown;
    form_extra_insurances?: unknown;
    form_additional_attractions?: unknown;
  },
): Array<{ service_type?: string; service_title?: string }> {
  const diets = asCatalogArray(catalogs.form_diets);
  const insurances = asCatalogArray(catalogs.form_extra_insurances);
  const attractions = asCatalogArray(catalogs.form_additional_attractions);

  const out: Array<{ service_type?: string; service_title?: string }> = [];
  const seen = new Set<string>();

  for (const participant of participants) {
    const selected = participant.selected_services;
    if (!selected || typeof selected !== "object") continue;
    const o = selected as Record<string, unknown>;

    const dietEntries = Array.isArray(o.diets) ? (o.diets as SelectedServiceEntry[]) : [];
    const insuranceEntries = Array.isArray(o.insurances)
      ? (o.insurances as SelectedServiceEntry[])
      : [];
    const attractionEntries = Array.isArray(o.attractions)
      ? (o.attractions as SelectedServiceEntry[])
      : [];

    for (const d of dietEntries) {
      const title =
        d.title?.trim() ||
        (d.service_id ? resolveCatalogTitle(diets, d.service_id, d.variant_id) : null);
      if (title) pushUnique(out, seen, "diet", title);
    }

    for (const ins of insuranceEntries) {
      const title =
        ins.title?.trim() ||
        (ins.service_id
          ? resolveCatalogTitle(insurances, ins.service_id, ins.variant_id)
          : null);
      if (title) pushUnique(out, seen, "insurance", title);
    }

    for (const a of attractionEntries) {
      if (a.include_in_contract === false) continue;
      const title =
        a.title?.trim() ||
        (a.service_id ? resolveCatalogTitle(attractions, a.service_id, a.variant_id) : null);
      if (title) pushUnique(out, seen, "attraction", title);
    }
  }

  return out;
}
