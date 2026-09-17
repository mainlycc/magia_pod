import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { syncFormExtraInsurancesForTrip } from "@/lib/insurance-local/sync-form-extra-insurances";

export type DuplicateTripResult = {
  id: string;
  title: string;
  slug: string;
};

/** Kolumny, których nie wolno kopiować 1:1 z wycieczki źródłowej. */
const TRIP_OMIT_COLUMNS = new Set(["id", "created_at", "updated_at", "registration_token"]);

async function generateNextNumericSlug(adminClient: SupabaseClient): Promise<string> {
  const { data: existingTrips, error } = await adminClient.from("trips").select("slug");
  if (error) throw new Error(`fetch_slugs_failed: ${error.message}`);

  let maxNumericSlug = 0;
  const usedSlugs = new Set<string>();

  for (const row of existingTrips ?? []) {
    const slug = row.slug as string | null;
    if (!slug) continue;
    usedSlugs.add(slug);
    if (/^\d+$/.test(slug)) {
      const numericValue = parseInt(slug, 10);
      if (!Number.isNaN(numericValue) && numericValue > maxNumericSlug) {
        maxNumericSlug = numericValue;
      }
    }
  }

  let newSlug = String(maxNumericSlug + 1);
  while (usedSlugs.has(newSlug)) {
    const n = parseInt(newSlug, 10);
    newSlug = String(Number.isNaN(n) ? maxNumericSlug + 1 : n + 1);
  }
  return newSlug;
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
): Promise<void> {
  const { data, error } = await adminClient.storage.from(bucket).download(sourcePath);
  if (error || !data) {
    throw new Error(`storage_download_failed: ${bucket}/${sourcePath}`);
  }

  const buffer = Buffer.from(await data.arrayBuffer());
  const { error: uploadError } = await adminClient.storage.from(bucket).upload(destPath, buffer, {
    contentType,
    upsert: false,
  });

  if (uploadError) {
    throw new Error(`storage_upload_failed: ${bucket}/${destPath}: ${uploadError.message}`);
  }
}

async function copyGalleryUrls(
  adminClient: SupabaseClient,
  newTripId: string,
  galleryUrls: string[] | null | undefined,
): Promise<string[]> {
  if (!galleryUrls || galleryUrls.length === 0) return [];

  const newUrls: string[] = [];

  for (const url of galleryUrls) {
    const sourcePath = extractStoragePathFromUrl(url, "trip-gallery");
    if (!sourcePath) {
      console.warn(`[duplicateTrip] Skipping gallery URL outside trip-gallery bucket: ${url}`);
      continue;
    }

    const ext = sourcePath.split(".").pop() || "jpg";
    const destPath = `${newTripId}/${randomUUID()}.${ext}`;
    const contentType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";

    await copyStorageFile(adminClient, "trip-gallery", sourcePath, destPath, contentType);
    const {
      data: { publicUrl },
    } = adminClient.storage.from("trip-gallery").getPublicUrl(destPath);
    newUrls.push(publicUrl);
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

  if (error) throw new Error(`copy_trip_documents_failed: ${error.message}`);
  if (!docs?.length) return;

  for (const doc of docs) {
    const ext = doc.file_name.split(".").pop() || "pdf";
    const destPath = `trips/${newTripId}/${doc.document_type}-${randomUUID()}.${ext}`;
    await copyStorageFile(adminClient, "documents", doc.file_name, destPath, "application/pdf");

    const { error: insertError } = await adminClient.from("trip_documents").insert({
      trip_id: newTripId,
      document_type: doc.document_type,
      file_name: destPath,
      display_name: doc.display_name,
    });
    if (insertError) throw new Error(`copy_trip_documents_failed: ${insertError.message}`);
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

  if (error) throw new Error(`copy_document_email_settings_failed: ${error.message}`);
  if (!settings?.length) return;

  const { error: insertError } = await adminClient.from("trip_document_email_settings").insert(
    settings.map((s) => ({
      trip_id: newTripId,
      document_type: s.document_type,
      attach_on_reservation: s.attach_on_reservation,
    })),
  );
  if (insertError) throw new Error(`copy_document_email_settings_failed: ${insertError.message}`);
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

  if (error) throw new Error(`copy_insurance_variants_failed: ${error.message}`);
  if (!variants?.length) return;

  const { error: insertError } = await adminClient.from("trip_insurance_variants").insert(
    variants.map((v) => ({
      trip_id: newTripId,
      variant_id: v.variant_id,
      price_grosz: v.price_grosz,
      is_enabled: v.is_enabled,
    })),
  );
  if (insertError) throw new Error(`copy_insurance_variants_failed: ${insertError.message}`);
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

  if (error) throw new Error(`copy_insurance_owu_documents_failed: ${error.message}`);
  if (!docs?.length) return;

  for (const doc of docs) {
    const destPath = `insurance-owu/${newTripId}/type-${doc.insurance_type}-${randomUUID()}.pdf`;
    await copyStorageFile(adminClient, "documents", doc.file_name, destPath, "application/pdf");

    const { error: insertError } = await adminClient.from("trip_insurance_owu_documents").insert({
      trip_id: newTripId,
      insurance_type: doc.insurance_type,
      file_name: destPath,
      display_name: doc.display_name,
    });
    if (insertError) throw new Error(`copy_insurance_owu_documents_failed: ${insertError.message}`);
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

  if (error) throw new Error(`copy_insurance_owu_email_settings_failed: ${error.message}`);
  if (!settings?.length) return;

  const { error: insertError } = await adminClient.from("trip_insurance_owu_email_settings").insert(
    settings.map((s) => ({
      trip_id: newTripId,
      insurance_type: s.insurance_type,
      attach_on_reservation: s.attach_on_reservation,
    })),
  );
  if (insertError) throw new Error(`copy_insurance_owu_email_settings_failed: ${insertError.message}`);
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

  if (error) throw new Error(`copy_agreement_templates_failed: ${error.message}`);
  if (!templates?.length) return;

  const { error: insertError } = await adminClient.from("trip_agreement_templates").insert(
    templates.map((t) => ({
      trip_id: newTripId,
      registration_type: t.registration_type,
      template_html: t.template_html,
    })),
  );
  if (insertError) throw new Error(`copy_agreement_templates_failed: ${insertError.message}`);
}

async function cleanupFailedDuplicate(adminClient: SupabaseClient, tripId: string): Promise<void> {
  const { error } = await adminClient.from("trips").delete().eq("id", tripId);
  if (error) {
    console.error(`[duplicateTrip] Failed to cleanup incomplete trip ${tripId}:`, error);
  }
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
  tripPayload.registration_token = randomUUID();

  const { data: newTrip, error: insertError } = await adminClient
    .from("trips")
    .insert(tripPayload)
    .select("id, title, slug")
    .single();

  if (insertError || !newTrip) {
    throw new Error(`duplicate_failed: ${insertError?.message ?? "unknown"}`);
  }

  const newTripId = newTrip.id as string;

  try {
    await Promise.all([
      copyInsuranceVariants(adminClient, sourceTripId, newTripId),
      copyInsuranceOwuEmailSettings(adminClient, sourceTripId, newTripId),
      copyTripDocumentEmailSettings(adminClient, sourceTripId, newTripId),
      copyAgreementTemplates(adminClient, sourceTripId, newTripId),
      copyTripDocuments(adminClient, sourceTripId, newTripId),
      copyInsuranceOwuDocuments(adminClient, sourceTripId, newTripId),
    ]);

    // Dopasuj form_extra_insurances do nowych UUID wierszy trip_insurance_variants
    const syncedInsurances = await syncFormExtraInsurancesForTrip(newTripId);
    if (syncedInsurances === null) {
      throw new Error("sync_form_extra_insurances_failed");
    }

    const newGalleryUrls = await copyGalleryUrls(adminClient, newTripId, sourceGalleryUrls);

    if (newGalleryUrls.length > 0) {
      const { error: galleryUpdateError } = await adminClient
        .from("trips")
        .update({ gallery_urls: newGalleryUrls })
        .eq("id", newTripId);
      if (galleryUpdateError) {
        throw new Error(`gallery_update_failed: ${galleryUpdateError.message}`);
      }
    }
  } catch (err) {
    await cleanupFailedDuplicate(adminClient, newTripId);
    throw err;
  }

  return {
    id: newTripId,
    title: newTrip.title as string,
    slug: newTrip.slug as string,
  };
}
