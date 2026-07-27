import type { SupabaseClient } from "@supabase/supabase-js";

export type DuplicateTripResult = {
  id: string;
  title: string;
  slug: string;
};

const TRIP_OMIT_COLUMNS = new Set(["id", "created_at"]);

async function generateNextNumericSlug(adminClient: SupabaseClient): Promise<string> {
  const { data: existingTrips, error } = await adminClient.from("trips").select("slug");
  if (error) throw new Error(`fetch_slugs_failed: ${error.message}`);

  let maxNumericSlug = 0;
  for (const row of existingTrips ?? []) {
    const slug = row.slug as string | null;
    if (slug && /^\d+$/.test(slug)) {
      const numericValue = parseInt(slug, 10);
      if (!Number.isNaN(numericValue) && numericValue > maxNumericSlug) {
        maxNumericSlug = numericValue;
      }
    }
  }
  return String(maxNumericSlug + 1);
}

function extractStoragePathFromUrl(url: string, bucket: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split("/");
    const bucketIndex = pathParts.indexOf(bucket);
    if (bucketIndex === -1) return null;
    return pathParts.slice(bucketIndex + 1).join("/");
  } catch {
    return null;
  }
}

async function copyStorageFile(
  adminClient: SupabaseClient,
  bucket: string,
  sourcePath: string,
  destPath: string,
  contentType: string,
): Promise<boolean> {
  const { data, error } = await adminClient.storage.from(bucket).download(sourcePath);
  if (error || !data) {
    console.error(`[duplicateTrip] Failed to download ${bucket}/${sourcePath}:`, error);
    return false;
  }

  const buffer = Buffer.from(await data.arrayBuffer());
  const { error: uploadError } = await adminClient.storage.from(bucket).upload(destPath, buffer, {
    contentType,
    upsert: false,
  });

  if (uploadError) {
    console.error(`[duplicateTrip] Failed to upload ${bucket}/${destPath}:`, uploadError);
    return false;
  }

  return true;
}

async function copyGalleryUrls(
  adminClient: SupabaseClient,
  sourceTripId: string,
  newTripId: string,
  galleryUrls: string[] | null | undefined,
): Promise<string[]> {
  if (!galleryUrls || galleryUrls.length === 0) return [];

  const newUrls: string[] = [];

  for (const url of galleryUrls) {
    const sourcePath = extractStoragePathFromUrl(url, "trip-gallery");
    if (!sourcePath) {
      continue;
    }

    const ext = sourcePath.split(".").pop() || "jpg";
    const destPath = `${newTripId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
    const contentType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";

    const copied = await copyStorageFile(adminClient, "trip-gallery", sourcePath, destPath, contentType);
    if (copied) {
      const {
        data: { publicUrl },
      } = adminClient.storage.from("trip-gallery").getPublicUrl(destPath);
      newUrls.push(publicUrl);
    }
  }

  return newUrls;
}

async function copyTripDocuments(
  adminClient: SupabaseClient,
  sourceTripId: string,
  newTripId: string,
): Promise<void> {
  const { data: docs, error } = await adminClient
    .from("trip_documents")
    .select("document_type, file_name, display_name")
    .eq("trip_id", sourceTripId);

  if (error || !docs?.length) return;

  for (const doc of docs) {
    const ext = doc.file_name.split(".").pop() || "pdf";
    const destPath = `trips/${newTripId}/${doc.document_type}-${Date.now()}.${ext}`;
    const copied = await copyStorageFile(
      adminClient,
      "documents",
      doc.file_name,
      destPath,
      "application/pdf",
    );

    if (!copied) continue;

    await adminClient.from("trip_documents").insert({
      trip_id: newTripId,
      document_type: doc.document_type,
      file_name: destPath,
      display_name: doc.display_name,
    });
  }
}

async function copyTripDocumentEmailSettings(
  adminClient: SupabaseClient,
  sourceTripId: string,
  newTripId: string,
): Promise<void> {
  const { data: settings, error } = await adminClient
    .from("trip_document_email_settings")
    .select("document_type, attach_on_reservation")
    .eq("trip_id", sourceTripId);

  if (error || !settings?.length) return;

  await adminClient.from("trip_document_email_settings").insert(
    settings.map((s) => ({
      trip_id: newTripId,
      document_type: s.document_type,
      attach_on_reservation: s.attach_on_reservation,
    })),
  );
}

async function copyInsuranceVariants(
  adminClient: SupabaseClient,
  sourceTripId: string,
  newTripId: string,
): Promise<void> {
  const { data: variants, error } = await adminClient
    .from("trip_insurance_variants")
    .select("variant_id, price_grosz, is_enabled")
    .eq("trip_id", sourceTripId);

  if (error || !variants?.length) return;

  await adminClient.from("trip_insurance_variants").insert(
    variants.map((v) => ({
      trip_id: newTripId,
      variant_id: v.variant_id,
      price_grosz: v.price_grosz,
      is_enabled: v.is_enabled,
    })),
  );
}

async function copyInsuranceOwuDocuments(
  adminClient: SupabaseClient,
  sourceTripId: string,
  newTripId: string,
): Promise<void> {
  const { data: docs, error } = await adminClient
    .from("trip_insurance_owu_documents")
    .select("insurance_type, file_name, display_name")
    .eq("trip_id", sourceTripId);

  if (error || !docs?.length) return;

  for (const doc of docs) {
    const destPath = `insurance-owu/${newTripId}/type-${doc.insurance_type}-${Date.now()}.pdf`;
    const copied = await copyStorageFile(
      adminClient,
      "documents",
      doc.file_name,
      destPath,
      "application/pdf",
    );

    if (!copied) continue;

    await adminClient.from("trip_insurance_owu_documents").insert({
      trip_id: newTripId,
      insurance_type: doc.insurance_type,
      file_name: destPath,
      display_name: doc.display_name,
    });
  }
}

async function copyInsuranceOwuEmailSettings(
  adminClient: SupabaseClient,
  sourceTripId: string,
  newTripId: string,
): Promise<void> {
  const { data: settings, error } = await adminClient
    .from("trip_insurance_owu_email_settings")
    .select("insurance_type, attach_on_reservation")
    .eq("trip_id", sourceTripId);

  if (error || !settings?.length) return;

  await adminClient.from("trip_insurance_owu_email_settings").insert(
    settings.map((s) => ({
      trip_id: newTripId,
      insurance_type: s.insurance_type,
      attach_on_reservation: s.attach_on_reservation,
    })),
  );
}

async function copyAgreementTemplates(
  adminClient: SupabaseClient,
  sourceTripId: string,
  newTripId: string,
): Promise<void> {
  const { data: templates, error } = await adminClient
    .from("trip_agreement_templates")
    .select("registration_type, template_html")
    .eq("trip_id", sourceTripId);

  if (error || !templates?.length) return;

  await adminClient.from("trip_agreement_templates").insert(
    templates.map((t) => ({
      trip_id: newTripId,
      registration_type: t.registration_type,
      template_html: t.template_html,
    })),
  );
}

export async function duplicateTripFull(
  adminClient: SupabaseClient,
  sourceTripId: string,
): Promise<DuplicateTripResult> {
  const { data: sourceTrip, error: fetchError } = await adminClient
    .from("trips")
    .select("*")
    .eq("id", sourceTripId)
    .single();

  if (fetchError || !sourceTrip) {
    throw new Error("not_found");
  }

  const newSlug = await generateNextNumericSlug(adminClient);
  const sourceTitle = (sourceTrip.title as string) || "Wycieczka";
  const sourceGalleryUrls = (sourceTrip.gallery_urls as string[] | null) ?? [];

  const tripPayload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(sourceTrip)) {
    if (!TRIP_OMIT_COLUMNS.has(key)) {
      tripPayload[key] = value;
    }
  }

  tripPayload.title = `${sourceTitle} (kopia)`;
  tripPayload.slug = newSlug;
  tripPayload.is_active = false;
  tripPayload.seats_reserved = 0;
  tripPayload.is_public = false;
  tripPayload.public_slug = null;
  tripPayload.gallery_urls = [];

  const { data: newTrip, error: insertError } = await adminClient
    .from("trips")
    .insert(tripPayload)
    .select("id, title, slug")
    .single();

  if (insertError || !newTrip) {
    throw new Error(`duplicate_failed: ${insertError?.message ?? "unknown"}`);
  }

  const newTripId = newTrip.id as string;

  await Promise.all([
    copyInsuranceVariants(adminClient, sourceTripId, newTripId),
    copyInsuranceOwuEmailSettings(adminClient, sourceTripId, newTripId),
    copyTripDocumentEmailSettings(adminClient, sourceTripId, newTripId),
    copyAgreementTemplates(adminClient, sourceTripId, newTripId),
    copyTripDocuments(adminClient, sourceTripId, newTripId),
    copyInsuranceOwuDocuments(adminClient, sourceTripId, newTripId),
  ]);

  const newGalleryUrls = await copyGalleryUrls(
    adminClient,
    sourceTripId,
    newTripId,
    sourceGalleryUrls,
  );

  if (newGalleryUrls.length > 0) {
    await adminClient.from("trips").update({ gallery_urls: newGalleryUrls }).eq("id", newTripId);
  }

  return {
    id: newTripId,
    title: newTrip.title as string,
    slug: newTrip.slug as string,
  };
}
