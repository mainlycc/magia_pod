/**
 * Wystawia zaległe faktury zaliczkowe dla wpłat wycieczki, które nie mają faktury.
 * Bez żadnych maili do klientów (skipCustomerEmail). Data sprzedaży = data wpłaty.
 * Domyślnie tryb podglądu; wystawienie dopiero z --apply. Raport zapisuje w audyty/.
 * Uruchom: pnpm dlx tsx scripts/issue-missing-invoices.ts "<fragment tytułu>" [--exclude BK-...] [--apply]
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

const root = resolve(__dirname, "..");
for (const line of readFileSync(resolve(root, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
}

const DELAY_BETWEEN_INVOICES_MS = 1500;

function parseArgs(argv: string[]) {
  const apply = argv.includes("--apply");
  const exclude = new Set<string>();
  const rest: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--apply") continue;
    if (argv[i] === "--exclude") {
      exclude.add(String(argv[++i] || "").toUpperCase());
      continue;
    }
    rest.push(argv[i]);
  }
  if (rest.length !== 1) throw new Error("Podaj dokładnie jeden fragment tytułu wycieczki");
  return { apply, exclude, titleFilter: rest[0] };
}

async function main() {
  const { processPaymentInvoice } = await import("../lib/invoices/invoice-service");
  const { apply, exclude, titleFilter } = parseArgs(process.argv.slice(2));

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

  const { data: trips, error: tripErr } = await admin
    .from("trips")
    .select("id, title, start_date")
    .ilike("title", `%${titleFilter}%`);
  if (tripErr) throw tripErr;
  if (!trips || trips.length !== 1) {
    throw new Error(`Oczekiwano 1 wycieczki dla "${titleFilter}", znaleziono ${trips?.length ?? 0}`);
  }
  const trip = trips[0];
  console.log(`Wycieczka: ${trip.title.trim()} (${trip.start_date}) — tryb: ${apply ? "WYSTAWIANIE" : "PODGLĄD"}`);

  const { data: bookings, error: bErr } = await admin
    .from("bookings")
    .select("id, booking_ref, contact_first_name, contact_last_name, status, cancelled_at")
    .eq("trip_id", trip.id);
  if (bErr) throw bErr;
  const bookingById = new Map((bookings ?? []).map((b) => [b.id, b]));

  const { data: payments, error: pErr } = await admin
    .from("payment_history")
    .select("id, booking_id, amount_cents, payment_date, created_at, payment_method")
    .in("booking_id", [...bookingById.keys()])
    .order("created_at", { ascending: true });
  if (pErr) throw pErr;

  const { data: invoices, error: iErr } = await admin
    .from("invoices")
    .select("payment_history_id, fakturownia_invoice_id")
    .in("payment_history_id", (payments ?? []).map((p) => p.id));
  if (iErr) throw iErr;
  // Rekord bez fakturownia_invoice_id = nieudana próba; processPaymentInvoice usuwa go i wystawia ponownie.
  const invoiced = new Set(
    (invoices ?? []).filter((i) => i.fakturownia_invoice_id).map((i) => i.payment_history_id),
  );

  const todo = (payments ?? [])
    .filter((p) => p.amount_cents > 0 && !invoiced.has(p.id))
    .map((p) => {
      const b = bookingById.get(p.booking_id)!;
      return {
        paymentId: p.id,
        bookingId: p.booking_id,
        bookingRef: b.booking_ref as string,
        name: `${b.contact_first_name ?? ""} ${b.contact_last_name ?? ""}`.trim(),
        bookingStatus: b.cancelled_at ? "anulowana" : (b.status as string | null),
        amountCents: p.amount_cents as number,
        sellDate: String(p.payment_date || p.created_at).slice(0, 10),
      };
    })
    .filter((row) => {
      if (exclude.has(row.bookingRef.toUpperCase())) {
        console.log(`  pomijam (--exclude): ${row.bookingRef} ${row.name}`);
        return false;
      }
      return true;
    });

  console.log(`\nWpłat: ${payments?.length ?? 0}, z fakturą: ${invoiced.size}, do wystawienia: ${todo.length}\n`);
  for (const row of todo) {
    console.log(
      `  ${row.bookingRef}  ${row.name.padEnd(28)} ${(row.amountCents / 100).toFixed(2).padStart(9)} zł  wpłata ${row.sellDate}  rezerwacja: ${row.bookingStatus ?? "-"}`,
    );
  }
  const totalCents = todo.reduce((s, r) => s + r.amountCents, 0);
  console.log(`\nRazem: ${(totalCents / 100).toFixed(2)} zł`);

  if (!apply) {
    console.log("\nPODGLĄD — nic nie wystawiono. Uruchom ponownie z --apply, żeby wystawić faktury.");
    return;
  }

  const results: Array<Record<string, unknown>> = [];
  for (const [index, row] of todo.entries()) {
    const backgroundTasks: Promise<void>[] = [];
    console.log(`\n[${index + 1}/${todo.length}] ${row.bookingRef} ${row.name} — ${(row.amountCents / 100).toFixed(2)} zł`);
    try {
      const result = await processPaymentInvoice({
        bookingId: row.bookingId,
        paymentHistoryId: row.paymentId,
        amountCents: row.amountCents,
        sellDate: row.sellDate,
        skipCustomerEmail: true,
        scheduleAfterResponse: (task) => backgroundTasks.push(task),
      });
      await Promise.allSettled(backgroundTasks);
      results.push({ ...row, ...result });
      console.log(
        result.success && result.providerInvoiceId
          ? `  ✓ ${result.invoiceNumber} (Fakturownia id ${result.providerInvoiceId})`
          : `  ✗ ${result.error ?? "brak dokumentu w Fakturowni"}`,
      );
    } catch (err) {
      results.push({ ...row, success: false, error: err instanceof Error ? err.message : String(err) });
      console.error("  ✗ wyjątek:", err);
    }
    await new Promise((r) => setTimeout(r, DELAY_BETWEEN_INVOICES_MS));
  }

  const ok = results.filter((r) => r.success && r.providerInvoiceId).length;
  console.log(`\nWystawiono w Fakturowni: ${ok}/${todo.length}`);

  const auditDir = resolve(root, "audyty");
  mkdirSync(auditDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = resolve(auditDir, `zalegle-faktury-${stamp}.json`);
  writeFileSync(reportPath, JSON.stringify({ trip, results }, null, 2), "utf8");
  console.log(`Raport: ${reportPath}`);

  if (ok !== todo.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
