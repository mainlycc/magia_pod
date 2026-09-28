#!/usr/bin/env node
/**
 * Audyt tylko do odczytu: porównuje statusy Paynow (API) z tym, co widzi
 * /trip-dashboard/uczestnicy (bookings.paid_amount_cents, payment_status, payment_history).
 * Uruchom: node scripts/audit-paynow.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv(path) {
  const env = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
  return env;
}

const env = loadEnv(resolve(root, ".env.local"));
const paynowBase =
  env.PAYNOW_ENV === "production" ? "https://api.paynow.pl" : "https://api.sandbox.paynow.pl";
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function fetchAll(table, select) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select(select).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

function extractPaymentId(notes) {
  if (!notes) return null;
  for (const p of [
    /Paynow payment ([A-Za-z0-9-]+)/i,
    /payment[:\s]+([A-Za-z0-9-]+)/i,
    /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i,
  ]) {
    const m = notes.match(p);
    if (m?.[1]) return m[1];
  }
  return null;
}

function isPaynowEntry(e) {
  return (e.payment_method ?? "").toLowerCase().trim() === "paynow" || /paynow payment/i.test(e.notes ?? "");
}

function countsTowardPaid(e) {
  const notes = e.notes ?? "";
  if (!isPaynowEntry(e)) return true;
  if (/status:\s*CONFIRMED/i.test(notes)) return true;
  if (/status:\s*(PENDING|NEW|WAITING|REJECTED|EXPIRED|ABANDONED|ERROR)/i.test(notes)) return false;
  if (/paynow payment/i.test(notes) && !/status:\s*\w+/i.test(notes)) return false;
  return true;
}

async function paynowStatus(paymentId) {
  const payload = JSON.stringify({
    headers: { "Api-Key": env.PAYNOW_API_KEY, "Idempotency-Key": paymentId },
    parameters: {},
    body: "",
  });
  const signature = crypto.createHmac("sha256", env.PAYNOW_SIGNATURE_KEY).update(payload, "utf8").digest("base64");
  const res = await fetch(`${paynowBase}/v3/payments/${paymentId}/status`, {
    headers: {
      "Content-Type": "application/json",
      "Api-Key": env.PAYNOW_API_KEY,
      Signature: signature,
      "Idempotency-Key": paymentId,
    },
  });
  if (!res.ok) return { error: `HTTP ${res.status}`, body: (await res.text().catch(() => "")).slice(0, 200) };
  return await res.json();
}

const pln = (c) => (c == null ? "—" : `${(c / 100).toFixed(2)} zł`);

const [trips, bookings, history, participants] = await Promise.all([
  fetchAll("trips", "id, title, start_date"),
  fetchAll("bookings", "id, trip_id, booking_ref, contact_email, payment_status, paid_amount_cents, first_payment_status, second_payment_status, created_at"),
  fetchAll("payment_history", "id, booking_id, amount_cents, payment_method, notes, created_at"),
  fetchAll("participants", "booking_id, first_name, last_name"),
]);

const tripById = new Map(trips.map((t) => [t.id, t]));
const bookingById = new Map(bookings.map((b) => [b.id, b]));
const namesByBooking = new Map();
for (const p of participants) {
  const list = namesByBooking.get(p.booking_id) ?? [];
  list.push(`${p.first_name ?? ""} ${p.last_name ?? ""}`.trim());
  namesByBooking.set(p.booking_id, list);
}

const paynowRows = history.filter(isPaynowEntry);
const ids = [...new Set(paynowRows.map((r) => extractPaymentId(r.notes)).filter(Boolean))];
console.log(`Paynow: ${env.PAYNOW_ENV}; rezerwacji ${bookings.length}; wpisów historii ${history.length}; wpisów Paynow ${paynowRows.length}; unikalnych paymentId ${ids.length}`);

const apiById = new Map();
for (const [i, id] of ids.entries()) {
  try {
    apiById.set(id, await paynowStatus(id));
  } catch (e) {
    apiById.set(id, { error: String(e) });
  }
  if ((i + 1) % 20 === 0) console.log(`  sprawdzono ${i + 1}/${ids.length}`);
}

const issues = [];
const perBooking = [];

for (const b of bookings) {
  const rows = history.filter((h) => h.booking_id === b.id);
  const trip = tripById.get(b.trip_id);
  const who = (namesByBooking.get(b.id) ?? []).join(", ") || b.contact_email || "?";
  const base = { trip: trip?.title ?? b.trip_id, bookingRef: b.booking_ref, who };

  const localCounted = rows.filter(countsTowardPaid).reduce((s, r) => s + (r.amount_cents || 0), 0);

  let paynowConfirmed = 0;
  let manual = 0;
  const seenConfirmed = new Set();
  const payments = [];

  for (const r of rows) {
    if (!isPaynowEntry(r)) {
      manual += r.amount_cents || 0;
      continue;
    }
    const id = extractPaymentId(r.notes);
    const api = id ? apiById.get(id) : null;
    const apiStatus = api?.status ?? null;
    const localStatus = (r.notes?.match(/status:\s*(\w+)/i)?.[1] ?? "BRAK").toUpperCase();
    const counted = countsTowardPaid(r);
    payments.push({ id, localStatus, apiStatus, amount: r.amount_cents, apiAmount: api?.amount, counted });

    if (!id) {
      issues.push({ ...base, type: "Wpis Paynow bez paymentId", detail: r.notes });
      continue;
    }
    if (api?.error) {
      issues.push({ ...base, type: "Błąd/brak w API Paynow", detail: `${id}: ${api.error} ${api.body ?? ""}` });
      continue;
    }
    if (apiStatus === "CONFIRMED") {
      if (seenConfirmed.has(id)) {
        if (counted) issues.push({ ...base, type: "Zdublowana wpłata (ten sam paymentId liczony 2x)", detail: `${id} ${pln(r.amount_cents)}` });
        continue;
      }
      seenConfirmed.add(id);
      paynowConfirmed += api.amount ?? r.amount_cents ?? 0;
      if (!counted) issues.push({ ...base, type: "Paynow CONFIRMED, lokalnie NIE liczone", detail: `${id} lokalnie ${localStatus}, ${pln(api.amount)}` });
      if (api.amount != null && r.amount_cents != null && api.amount !== r.amount_cents)
        issues.push({ ...base, type: "Różna kwota lokalnie vs Paynow", detail: `${id}: lokalnie ${pln(r.amount_cents)}, Paynow ${pln(api.amount)}` });
    } else if (counted) {
      issues.push({ ...base, type: "Lokalnie liczone jako wpłata, Paynow NIE CONFIRMED", detail: `${id}: lokalnie ${localStatus}, Paynow ${apiStatus}, ${pln(r.amount_cents)}` });
    } else if (apiStatus && localStatus !== apiStatus) {
      issues.push({ ...base, type: "Nieaktualny status w notatce (bez wpływu na sumę)", detail: `${id}: lokalnie ${localStatus}, Paynow ${apiStatus}` });
    }
  }

  const expectedPaid = paynowConfirmed + manual;
  if ((b.paid_amount_cents ?? 0) !== localCounted)
    issues.push({ ...base, type: "paid_amount_cents ≠ suma historii (nieprzeliczona rezerwacja)", detail: `w tabeli ${pln(b.paid_amount_cents)}, z historii ${pln(localCounted)}` });
  if ((b.paid_amount_cents ?? 0) !== expectedPaid && payments.length)
    issues.push({ ...base, type: "Suma w tabeli ≠ Paynow CONFIRMED + ręczne", detail: `w tabeli ${pln(b.paid_amount_cents)} (${b.payment_status}), powinno ${pln(expectedPaid)} (Paynow ${pln(paynowConfirmed)} + ręczne ${pln(manual)})` });
  if (b.payment_status !== "unpaid" && (b.paid_amount_cents ?? 0) === 0)
    issues.push({ ...base, type: "Status opłacony przy 0 zł", detail: b.payment_status });
  if (b.payment_status === "unpaid" && (b.paid_amount_cents ?? 0) > 0)
    issues.push({ ...base, type: "Status unpaid przy wpłacie > 0", detail: pln(b.paid_amount_cents) });

  perBooking.push({ ...base, status: b.payment_status, paid: b.paid_amount_cents, paynowConfirmed, manual, payments });
}

const orphan = paynowRows.filter((r) => !bookingById.has(r.booking_id));
for (const r of orphan) issues.push({ trip: "?", bookingRef: "?", who: "?", type: "Wpis Paynow bez rezerwacji", detail: r.notes });

const statusCounts = {};
for (const v of apiById.values()) {
  const k = v.status ?? v.error ?? "?";
  statusCounts[k] = (statusCounts[k] ?? 0) + 1;
}

const outDir = resolve(root, "audyty");
mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
writeFileSync(
  resolve(outDir, `audyt-paynow-${stamp}.json`),
  JSON.stringify({ environment: env.PAYNOW_ENV, statusCounts, issues, perBooking, paynow: Object.fromEntries(apiById) }, null, 2),
);

console.log("\nStatusy w Paynow:", statusCounts);
console.log(`Rezerwacje z Paynow: ${perBooking.filter((p) => p.payments.length).length}`);
console.log(`\nNiezgodności: ${issues.length}`);
const byType = {};
for (const i of issues) (byType[i.type] ??= []).push(i);
for (const [type, list] of Object.entries(byType)) {
  console.log(`\n## ${type} (${list.length})`);
  for (const i of list) console.log(`- [${i.trip}] ${i.bookingRef} — ${i.who}: ${i.detail}`);
}
console.log(`\nRaport: audyty/audyt-paynow-${stamp}.json`);
