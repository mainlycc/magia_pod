import type { SupabaseClient } from "@supabase/supabase-js";
import { SYNCED_INSURANCE_ID_PREFIX } from "@/lib/insurance-local/sync-form-extra-insurances";
import { tripInsuranceVariantIdFromServiceId } from "@/lib/insurance-local/sync-participant-insurances";

type InsuranceVariantInfo = {
  type: number;
  name: string;
  provider: string | null;
  description: string | null;
};

type TripInsuranceVariantRow = {
  id: string;
  is_enabled: boolean;
  insurance_variants: InsuranceVariantInfo | InsuranceVariantInfo[] | null;
};

type FormExtraInsurance = {
  id: string;
  title?: string;
  description?: string;
};

export type InsuranceScopeParticipant = {
  first_name?: string;
  last_name?: string;
  selected_services?: unknown;
};

function normalizeVariant(
  raw: InsuranceVariantInfo | InsuranceVariantInfo[] | null,
): InsuranceVariantInfo | null {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw;
}

function formatVariantLine(variant: InsuranceVariantInfo): string {
  const parts = [variant.name];
  if (variant.provider?.trim()) {
    parts.push(`(${variant.provider.trim()})`);
  }
  const header = parts.join(" ");
  if (variant.description?.trim()) {
    return `${header} — ${variant.description.trim()}`;
  }
  return header;
}

function parseSelectedInsurances(selectedServices: unknown): Array<{ service_id: string }> {
  if (!selectedServices || typeof selectedServices !== "object") return [];
  const raw = selectedServices as Record<string, unknown>;
  if (!Array.isArray(raw.insurances)) return [];
  return raw.insurances.filter(
    (entry): entry is { service_id: string } =>
      Boolean(entry) &&
      typeof entry === "object" &&
      typeof (entry as { service_id?: string }).service_id === "string",
  );
}

function resolveInsuranceTitle(
  serviceId: string,
  tripVariantsById: Map<string, TripInsuranceVariantRow>,
  manualInsurances: FormExtraInsurance[],
): string | null {
  const tripVariantId = tripInsuranceVariantIdFromServiceId(serviceId);
  if (tripVariantId) {
    const row = tripVariantsById.get(tripVariantId);
    const variant = normalizeVariant(row?.insurance_variants ?? null);
    if (variant) return formatVariantLine(variant);
  }

  const manual = manualInsurances.find((item) => item.id === serviceId);
  if (manual) {
    const title = manual.title?.trim() || "Dodatkowe ubezpieczenie";
    const desc = manual.description?.trim();
    return desc ? `${title} — ${desc}` : title;
  }

  if (serviceId.startsWith(SYNCED_INSURANCE_ID_PREFIX)) {
    return null;
  }

  return serviceId.trim() || null;
}

/**
 * Składa tekst zakresu ubezpieczenia dla placeholdera {{insurance_scope}}.
 * Bez uczestników zwraca ubezpieczenie typ 1 przypisane do wycieczki.
 *
 * `options.includeAvailableExtras` — tryb podglądu umowy (brak konkretnych
 * uczestników): dokleja listę dostępnych ubezpieczeń dodatkowych (typ 2 i 3)
 * z nazwą i zakresem, aby `{{insurance_scope}}` nie był ograniczony do typu 1.
 */
export async function buildInsuranceScope(
  supabase: SupabaseClient,
  tripId: string,
  participants?: InsuranceScopeParticipant[] | null,
  formExtraInsurances?: unknown,
  options?: { includeAvailableExtras?: boolean },
): Promise<string> {
  const { data: tripVariants, error } = await supabase
    .from("trip_insurance_variants")
    .select(`
      id,
      is_enabled,
      insurance_variants (
        type,
        name,
        provider,
        description
      )
    `)
    .eq("trip_id", tripId);

  if (error) {
    console.error("[buildInsuranceScope] fetch error:", error.message);
    return "-";
  }

  const rows = (tripVariants ?? []) as TripInsuranceVariantRow[];
  const enabledRows = rows.filter((row) => row.is_enabled !== false);
  const tripVariantsById = new Map(enabledRows.map((row) => [row.id, row]));

  const type1Row = enabledRows.find((row) => normalizeVariant(row.insurance_variants)?.type === 1);
  const type1Variant = type1Row ? normalizeVariant(type1Row.insurance_variants) : null;

  const manualInsurances = Array.isArray(formExtraInsurances)
    ? (formExtraInsurances as FormExtraInsurance[])
    : [];

  const sections: string[] = [];

  if (type1Variant) {
    sections.push(`Ubezpieczenie podstawowe (w cenie): ${formatVariantLine(type1Variant)}`);
  }

  const participantRows = participants ?? [];
  const extraLines: string[] = [];

  for (const participant of participantRows) {
    const name = [participant.first_name, participant.last_name].filter(Boolean).join(" ").trim();
    const label = name || "Uczestnik";

    for (const entry of parseSelectedInsurances(participant.selected_services)) {
      const tripVariantId = tripInsuranceVariantIdFromServiceId(entry.service_id);
      const row = tripVariantId ? tripVariantsById.get(tripVariantId) : undefined;
      const variant = row ? normalizeVariant(row.insurance_variants) : null;

      if (variant?.type === 1) continue;

      const line = resolveInsuranceTitle(entry.service_id, tripVariantsById, manualInsurances);
      if (line) {
        extraLines.push(`- ${label}: ${line}`);
      }
    }
  }

  if (extraLines.length > 0) {
    sections.push("Dodatkowe ubezpieczenia:", ...extraLines);
  }

  // Tryb podglądu (brak konkretnych uczestników): pokaż dostępne ubezpieczenia
  // dodatkowe (typ 2 i 3) z nazwą i zakresem, aby placeholder nie był pusty.
  if (options?.includeAvailableExtras && participantRows.length === 0) {
    const availableLines: string[] = [];
    for (const row of enabledRows) {
      const variant = normalizeVariant(row.insurance_variants);
      if (!variant || variant.type === 1) continue;
      availableLines.push(`- ${formatVariantLine(variant)}`);
    }
    if (availableLines.length > 0) {
      sections.push("Dostępne ubezpieczenia dodatkowe:", ...availableLines);
    }
  }

  if (sections.length === 0) {
    return "-";
  }

  return sections.join("\n");
}
