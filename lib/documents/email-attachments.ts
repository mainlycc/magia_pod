import { createAdminClient } from "@/lib/supabase/admin";
import { DOCUMENT_TYPES } from "@/lib/documents/constants";

export type Base64Attachment = { filename: string; base64: string };

type DocumentRow = {
  document_type: string;
  file_name: string;
  display_name: string | null;
};

function guessPdfFilename(row: DocumentRow): string {
  const baseFromStorage = (row.file_name || "").split("/").pop() || row.file_name || "dokument.pdf";
  const base = (row.display_name || "").trim() || baseFromStorage;
  return base.toLowerCase().endsWith(".pdf") ? base : `${base}.pdf`;
}

/**
 * Zwraca komplet dokumentów z zakładki "Dokumentacja" dla danej wycieczki.
 * Zasada: dokumenty trip nadpisują globalne; zwracamy tylko te, które istnieją.
 */
export async function getTripDocumentationEmailAttachments(params: {
  tripId: string;
  /**
   * Podaj admin client, jeśli już go masz (np. w route handlerze).
   * Jeśli nie podasz, helper utworzy własny.
   */
  adminClient?: ReturnType<typeof createAdminClient>;
}): Promise<Base64Attachment[]> {
  const adminClient = params.adminClient ?? createAdminClient();
  const tripId = params.tripId;

  const { data: tripDocs, error: tripErr } = await adminClient
    .from("trip_documents")
    .select("document_type, file_name, display_name")
    .eq("trip_id", tripId);
  if (tripErr) {
    console.error("[DocsEmail] Failed to fetch trip_documents:", tripErr);
  }

  const { data: globalDocs, error: globalErr } = await adminClient
    .from("global_documents")
    .select("document_type, file_name, display_name");
  if (globalErr) {
    console.error("[DocsEmail] Failed to fetch global_documents:", globalErr);
  }

  const tripMap = new Map<string, DocumentRow>((tripDocs || []).map((d) => [d.document_type, d as DocumentRow]));
  const globalMap = new Map<string, DocumentRow>(
    (globalDocs || []).map((d) => [d.document_type, d as DocumentRow]),
  );

  const { data: emailSettingsRows, error: emailSettingsErr } = await adminClient
    .from("trip_document_email_settings")
    .select("document_type, attach_on_reservation")
    .eq("trip_id", tripId);

  if (emailSettingsErr) {
    console.error("[DocsEmail] Failed to fetch trip_document_email_settings:", emailSettingsErr);
  }

  const attachSettingsMap = new Map<string, boolean>(
    (emailSettingsRows || []).map((row) => [row.document_type, row.attach_on_reservation]),
  );

  const chosen: { row: DocumentRow; documentType: string }[] = [];
  for (const t of DOCUMENT_TYPES) {
    const row = tripMap.get(t) ?? globalMap.get(t);
    if (!row?.file_name) continue;

    const attachOnReservation = attachSettingsMap.get(t) ?? true;
    if (!attachOnReservation) continue;

    chosen.push({ row, documentType: t });
  }

  const attachments: Base64Attachment[] = [];
  for (const { row } of chosen) {
    try {
      const { data: fileBlob, error: dlErr } = await adminClient.storage.from("documents").download(row.file_name);
      if (dlErr || !fileBlob) {
        console.error("[DocsEmail] Failed to download document:", { file: row.file_name, err: dlErr });
        continue;
      }
      const arrayBuffer = await fileBlob.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");
      attachments.push({ filename: guessPdfFilename(row), base64 });
    } catch (e) {
      console.error("[DocsEmail] Unexpected error downloading document:", { file: row.file_name, err: e });
    }
  }

  return attachments;
}

