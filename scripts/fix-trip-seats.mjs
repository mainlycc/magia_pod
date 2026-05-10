import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const slug = process.argv[2] ?? "test-maroko-split";
const bumpBy = Number(process.argv[3] ?? 20);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  // eslint-disable-next-line no-console
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const orFilter = `slug.eq.${slug},public_slug.eq.${slug}`;

const { data: trips, error: readErr } = await supabase
  .from("trips")
  .select("id,slug,public_slug,title,seats_total,seats_reserved,is_active")
  .or(orFilter);

if (readErr) {
  // eslint-disable-next-line no-console
  console.error(readErr);
  process.exit(1);
}

if (!trips || trips.length === 0) {
  // eslint-disable-next-line no-console
  console.log("No trips found for slug:", slug);
  process.exit(0);
}

const trip = trips[0];
const reserved = trip.seats_reserved ?? 0;
const currentTotal = trip.seats_total ?? 0;
const newTotal = Math.max(currentTotal, reserved + bumpBy, 12);

const { data: updated, error: updErr } = await supabase
  .from("trips")
  .update({ seats_total: newTotal, is_active: true })
  .eq("id", trip.id)
  .select("id,slug,seats_total,seats_reserved,is_active")
  .single();

if (updErr) {
  // eslint-disable-next-line no-console
  console.error(updErr);
  process.exit(1);
}

// eslint-disable-next-line no-console
console.log("Before:", trip);
// eslint-disable-next-line no-console
console.log("After:", updated);

