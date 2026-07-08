import type { SupabaseClient } from "@supabase/supabase-js";
import { syncFormExtraInsurancesForTrip } from "@/lib/insurance-local/sync-form-extra-insurances";

type DefaultRow = {
  variant_id: string;
  price_grosz: number | null;
  is_enabled: boolean;
  insurance_variants: {
    id: string;
    type: number;
    is_active: boolean;
  }[] | null;
};

/**
 * Przypisuje domyślne warianty ubezpieczeń do nowo utworzonej wycieczki
 * na podstawie konfiguracji globalnej.
 */
export async function seedDefaultInsuranceForTrip(
  supabase: SupabaseClient,
  tripId: string,
): Promise<void> {
  const { data: defaults, error: defaultsError } = await supabase
    .from("global_insurance_trip_defaults")
    .select(`
      variant_id,
      price_grosz,
      is_enabled,
      insurance_variants (
        id,
        type,
        is_active
      )
    `)
    .eq("is_enabled", true);

  if (defaultsError) {
    console.error("[seedDefaultInsuranceForTrip] Failed to load defaults:", defaultsError);
    return;
  }

  const rows = ((defaults ?? []) as unknown as DefaultRow[]).filter((row) =>
    row.insurance_variants?.some((v) => v.is_active),
  );

  if (rows.length === 0) {
    return;
  }

  const insertRows = rows.map((row) => ({
    trip_id: tripId,
    variant_id: row.variant_id,
    price_grosz: row.price_grosz,
    is_enabled: true,
  }));

  const { error: insertError } = await supabase
    .from("trip_insurance_variants")
    .insert(insertRows);

  if (insertError) {
    console.error("[seedDefaultInsuranceForTrip] Failed to insert trip variants:", insertError);
    return;
  }

  try {
    await syncFormExtraInsurancesForTrip(tripId);
  } catch (syncError) {
    console.error("[seedDefaultInsuranceForTrip] sync form insurances failed:", syncError);
  }
}
