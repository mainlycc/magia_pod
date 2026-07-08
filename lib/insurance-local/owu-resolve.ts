import {
  INSURANCE_OWU_TYPES,
  type InsuranceOwuType,
} from "@/lib/insurance-local/owu-constants";

export type OwuDocumentRow = {
  insurance_type: number;
  file_name: string;
  display_name: string | null;
};

export type ResolvedOwuDocument = OwuDocumentRow & {
  source: "trip" | "global";
  id?: string;
  created_at?: string;
  updated_at?: string;
  url?: string;
};

/** Trip nadpisuje globalne OWU — zwraca mapę typ → dokument. */
export function buildOwuDocumentsMap(params: {
  tripDocs: OwuDocumentRow[];
  globalDocs: OwuDocumentRow[];
}): Map<number, ResolvedOwuDocument> {
  const tripMap = new Map(
    params.tripDocs.map((doc) => [doc.insurance_type, doc]),
  );
  const globalMap = new Map(
    params.globalDocs.map((doc) => [doc.insurance_type, doc]),
  );

  const result = new Map<number, ResolvedOwuDocument>();

  for (const type of INSURANCE_OWU_TYPES) {
    const tripDoc = tripMap.get(type);
    if (tripDoc) {
      result.set(type, { ...tripDoc, source: "trip" });
      continue;
    }

    const globalDoc = globalMap.get(type);
    if (globalDoc) {
      result.set(type, { ...globalDoc, source: "global" });
    }
  }

  return result;
}

export function listResolvedOwuDocuments(
  documentsMap: Map<number, ResolvedOwuDocument>,
): ResolvedOwuDocument[] {
  return INSURANCE_OWU_TYPES.map((type) => documentsMap.get(type)).filter(
    (doc): doc is ResolvedOwuDocument => Boolean(doc),
  );
}
