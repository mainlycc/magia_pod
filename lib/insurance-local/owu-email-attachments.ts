import { createAdminClient } from "@/lib/supabase/admin";
import {
  INSURANCE_OWU_TYPES,
  INSURANCE_OWU_TYPE_LABELS,
  type InsuranceOwuType,
  isValidInsuranceOwuType,
} from "@/lib/insurance-local/owu-constants";
import { buildOwuDocumentsMap } from "@/lib/insurance-local/owu-resolve";

export type Base64Attachment = { filename: string; base64: string };

type OwuDocumentRow = {
  insurance_type: number;
  file_name: string;
  display_name: string | null;
};

function extractPurchasedVariantIdsByType(
  rows: ParticipantInsuranceRow[],
): Map<InsuranceOwuType, string> {
  const result = new Map<InsuranceOwuType, string>();

  for (const row of rows) {
    if (row.status === "cancelled") continue;

    const tivArr = Array.isArray(row.trip_insurance_variants)
      ? row.trip_insurance_variants
      : row.trip_insurance_variants
        ? [row.trip_insurance_variants]
        : [];

    for (const variant of tivArr) {
      const iv = variant?.insurance_variants;
      const items = Array.isArray(iv) ? iv : iv ? [iv] : [];

      for (const item of items) {
        if (item?.type != null && isValidInsuranceOwuType(item.type) && item.id) {
          if (!result.has(item.type)) {
            result.set(item.type, item.id);
          }
        }
      }
    }
  }

  return result;
}

function guessAttachmentFilename(row: {
  file_name: string;
  display_name: string | null;
  insurance_type?: number;
}): string {
  const typeLabel =
    row.insurance_type != null && isValidInsuranceOwuType(row.insurance_type)
      ? INSURANCE_OWU_TYPE_LABELS[row.insurance_type]
      : "Ubezpieczenie";
  const base = (row.display_name || "").trim() || `OWU ${typeLabel}`;
  return base.toLowerCase().endsWith(".pdf") ? base : `${base}.pdf`;
}

type NestedInsuranceVariant = { id?: string | null; type?: number | null };
type TripInsuranceVariantJoin = {
  insurance_variants?: NestedInsuranceVariant | NestedInsuranceVariant[] | null;
} | null;

type ParticipantInsuranceRow = {
  status: string;
  trip_insurance_variants?:
    | TripInsuranceVariantJoin
    | TripInsuranceVariantJoin[]
    | null;
};

function extractVariantTypesFromJoin(
  tiv: ParticipantInsuranceRow["trip_insurance_variants"],
): number[] {
  if (!tiv) return [];

  const tivArr = Array.isArray(tiv) ? tiv : [tiv];
  const types: number[] = [];

  for (const variant of tivArr) {
    const iv = variant?.insurance_variants;
    if (!iv) continue;

    if (Array.isArray(iv)) {
      for (const item of iv) {
        if (item?.type != null) types.push(item.type);
      }
    } else if (iv.type != null) {
      types.push(iv.type);
    }
  }

  return types;
}

/** Zwraca typy ubezpieczeń wykupione w rezerwacji (bez anulowanych). */
export function extractPurchasedInsuranceTypes(
  rows: ParticipantInsuranceRow[],
): InsuranceOwuType[] {
  const types = new Set<InsuranceOwuType>();

  for (const row of rows) {
    if (row.status === "cancelled") continue;
    for (const variantType of extractVariantTypesFromJoin(row.trip_insurance_variants)) {
      if (isValidInsuranceOwuType(variantType)) {
        types.add(variantType);
      }
    }
  }

  return INSURANCE_OWU_TYPES.filter((t) => types.has(t));
}

/** Filtruje typy OWU do załączenia: tylko wykupione + istniejący plik + włączona wysyłka. */
export function resolveOwuTypesToAttach(params: {
  purchasedTypes: InsuranceOwuType[];
  documentsByType: Map<number, OwuDocumentRow>;
  attachSettings: Map<number, boolean>;
}): InsuranceOwuType[] {
  const result: InsuranceOwuType[] = [];

  for (const type of params.purchasedTypes) {
    const doc = params.documentsByType.get(type);
    if (!doc?.file_name) continue;

    const attachOnReservation = params.attachSettings.get(type) ?? true;
    if (!attachOnReservation) continue;

    result.push(type);
  }

  return result;
}

/**
 * Zwraca załączniki OWU ubezpieczeń dla maila po rezerwacji.
 * Wysyła OWU tylko dla typów faktycznie wykupionych w danej rezerwacji.
 */
export async function getInsuranceOwuEmailAttachments(params: {
  tripId: string;
  bookingId: string;
  adminClient?: ReturnType<typeof createAdminClient>;
}): Promise<Base64Attachment[]> {
  const adminClient = params.adminClient ?? createAdminClient();
  const { tripId, bookingId } = params;

  const { data: participantInsurances, error: piErr } = await adminClient
    .from("participant_insurances")
    .select(
      `
      status,
      trip_insurance_variants (
        insurance_variants ( id, type )
      )
    `,
    )
    .eq("booking_id", bookingId);

  if (piErr) {
    console.error("[InsuranceOwuEmail] Failed to fetch participant_insurances:", piErr);
    return [];
  }

  const purchasedTypes = extractPurchasedInsuranceTypes(participantInsurances || []);
  const purchasedVariantIdsByType = extractPurchasedVariantIdsByType(participantInsurances || []);

  if (purchasedTypes.length === 0) {
    return [];
  }

  const purchasedVariantIds = Array.from(purchasedVariantIdsByType.values());

  const [tripOwuRes, globalOwuRes, variantOwuRes] = await Promise.all([
    adminClient
      .from("trip_insurance_owu_documents")
      .select("insurance_type, file_name, display_name")
      .eq("trip_id", tripId),
    adminClient
      .from("global_insurance_owu_documents")
      .select("insurance_type, file_name, display_name"),
    purchasedVariantIds.length > 0
      ? adminClient
          .from("insurance_variant_attachments")
          .select("variant_id, file_name, display_name, attachment_type")
          .in("variant_id", purchasedVariantIds)
          .eq("attachment_type", "owu")
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (tripOwuRes.error) {
    console.error("[InsuranceOwuEmail] Failed to fetch trip_insurance_owu_documents:", tripOwuRes.error);
  }
  if (globalOwuRes.error) {
    console.error("[InsuranceOwuEmail] Failed to fetch global_insurance_owu_documents:", globalOwuRes.error);
  }
  if (variantOwuRes.error) {
    console.error("[InsuranceOwuEmail] Failed to fetch insurance_variant_attachments:", variantOwuRes.error);
  }

  const variantOwuByVariantId = new Map(
    (variantOwuRes.data || []).map((row) => [row.variant_id as string, row]),
  );

  const documentsMap = buildOwuDocumentsMap({
    tripDocs: tripOwuRes.data || [],
    globalDocs: globalOwuRes.data || [],
  });

  const [tripSettingsRes, globalSettingsRes] = await Promise.all([
    adminClient
      .from("trip_insurance_owu_email_settings")
      .select("insurance_type, attach_on_reservation")
      .eq("trip_id", tripId),
    adminClient
      .from("global_insurance_owu_email_settings")
      .select("insurance_type, attach_on_reservation"),
  ]);

  if (tripSettingsRes.error) {
    console.error("[InsuranceOwuEmail] Failed to fetch trip_insurance_owu_email_settings:", tripSettingsRes.error);
  }
  if (globalSettingsRes.error) {
    console.error("[InsuranceOwuEmail] Failed to fetch global_insurance_owu_email_settings:", globalSettingsRes.error);
  }

  const documentsByType = new Map<number, OwuDocumentRow>(
    Array.from(documentsMap.entries()).map(([type, doc]) => [type, doc]),
  );

  // Ustawienia globalne jako baza, ewentualne ustawienia per wycieczka nadpisują.
  const attachSettings = new Map<number, boolean>(
    (globalSettingsRes.data || []).map((row) => [row.insurance_type, row.attach_on_reservation]),
  );
  for (const row of tripSettingsRes.data || []) {
    attachSettings.set(row.insurance_type, row.attach_on_reservation);
  }

  const typesToAttach = resolveOwuTypesToAttach({
    purchasedTypes,
    documentsByType,
    attachSettings,
  });

  const attachments: Base64Attachment[] = [];

  for (const type of typesToAttach) {
    const variantId = purchasedVariantIdsByType.get(type);
    const variantOwu = variantId ? variantOwuByVariantId.get(variantId) : undefined;
    const typeOwu = documentsByType.get(type);

    const row = variantOwu?.file_name
      ? {
          file_name: variantOwu.file_name,
          display_name: variantOwu.display_name,
          insurance_type: type,
        }
      : typeOwu;

    if (!row?.file_name) continue;

    try {
      const { data: fileBlob, error: dlErr } = await adminClient.storage
        .from("documents")
        .download(row.file_name);

      if (dlErr || !fileBlob) {
        console.error("[InsuranceOwuEmail] Failed to download OWU:", {
          file: row.file_name,
          err: dlErr,
        });
        continue;
      }

      const arrayBuffer = await fileBlob.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");
      attachments.push({ filename: guessAttachmentFilename(row), base64 });
    } catch (e) {
      console.error("[InsuranceOwuEmail] Unexpected error downloading OWU:", {
        file: row.file_name,
        err: e,
      });
    }
  }

  return attachments;
}
