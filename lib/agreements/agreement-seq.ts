import type { SupabaseClient } from "@supabase/supabase-js";

/** Następny wolny numer kolejny umowy dla wszystkich rezerwacji danej wycieczki. */
export async function getNextAgreementSeq(
  admin: SupabaseClient,
  tripId: string,
): Promise<number> {
  const { data: tripBookings, error: bookingsError } = await admin
    .from("bookings")
    .select("id")
    .eq("trip_id", tripId);

  if (bookingsError || !tripBookings?.length) {
    return 1;
  }

  const bookingIds = tripBookings.map((b) => b.id);
  const { data: rows, error: agError } = await admin
    .from("agreements")
    .select("agreement_seq")
    .in("booking_id", bookingIds);

  if (agError || !rows?.length) {
    return 1;
  }

  const nums = rows
    .map((r) => r.agreement_seq)
    .filter((n): n is number => typeof n === "number" && n > 0);
  if (nums.length === 0) return 1;
  return Math.max(...nums) + 1;
}
