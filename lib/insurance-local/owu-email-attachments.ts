import { createAdminClient } from "@/lib/supabase/admin";
import {
  INSURANCE_OWU_TYPES,
  INSURANCE_OWU_TYPE_LABELS,
  type InsuranceOwuType,
  isValidInsuranceOwuType,
} from "@/lib/insurance-local/owu-constants";

export type Base64Attachment = { filename: string; base64: string };

type OwuDocumentRow = {
  insurance_type: number;
  file_name: string;
  display_name: string | null;
};

function guessOwuPdfFilename(row: OwuDocumentRow): string {
  const typeLabel = isValidInsuranceOwuType(row.insurance_type)
    ? INSURANCE_OWU_TYPE_LABELS[row.insurance_type]
    : `Typ ${row.insurance_type}`;
  const baseFromStorage =
    (row.file_name || "").split("/").pop() || row.file_name || "owu-ubezpieczenie.pdf";
  const base = (row.display_name || "").trim() || `OWU ${typeLabel}`;
  return base.toLowerCase().endsWith(".pdf") ? base : `${base}.pdf`;
}

type NestedInsuranceVariant = { type?: number | null };
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
        insurance_variants ( type )
      )
    `,
    )
    .eq("booking_id", bookingId);

  if (piErr) {
    console.error("[InsuranceOwuEmail] Failed to fetch participant_insurances:", piErr);
    return [];
  }

  const purchasedTypes = extractPurchasedInsuranceTypes(participantInsurances || []);

  if (purchasedTypes.length === 0) {
    return [];
  }

  const { data: owuDocs, error: owuErr } = await adminClient
    .from("trip_insurance_owu_documents")
    .select("insurance_type, file_name, display_name")
    .eq("trip_id", tripId);

  if (owuErr) {
    console.error("[InsuranceOwuEmail] Failed to fetch trip_insurance_owu_documents:", owuErr);
    return [];
  }

  const { data: emailSettingsRows, error: settingsErr } = await adminClient
    .from("trip_insurance_owu_email_settings")
    .select("insurance_type, attach_on_reservation")
    .eq("trip_id", tripId);

  if (settingsErr) {
    console.error("[InsuranceOwuEmail] Failed to fetch trip_insurance_owu_email_settings:", settingsErr);
  }

  const documentsByType = new Map<number, OwuDocumentRow>(
    (owuDocs || []).map((d) => [d.insurance_type, d as OwuDocumentRow]),
  );

  const attachSettings = new Map<number, boolean>(
    (emailSettingsRows || []).map((row) => [row.insurance_type, row.attach_on_reservation]),
  );

  const typesToAttach = resolveOwuTypesToAttach({
    purchasedTypes,
    documentsByType,
    attachSettings,
  });

  const attachments: Base64Attachment[] = [];

  for (const type of typesToAttach) {
    const row = documentsByType.get(type);
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
      attachments.push({ filename: guessOwuPdfFilename(row), base64 });
    } catch (e) {
      console.error("[InsuranceOwuEmail] Unexpected error downloading OWU:", {
        file: row.file_name,
        err: e,
      });
    }
  }

  return attachments;
}
