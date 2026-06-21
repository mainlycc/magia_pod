#!/usr/bin/env node
/**
 * Szybka weryfikacja środowiska przed testami manualnymi (Faza 0).
 * Uruchom: node scripts/check-manual-test-env.mjs
 * Nie wypisuje wartości sekretów — tylko OK / BRAK.
 */
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const envPath = resolve(root, ".env.local");

const REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "RESEND_API_KEY",
  "PAYNOW_API_KEY",
  "PAYNOW_SIGNATURE_KEY",
  "PAYNOW_ENV",
];

const OPTIONAL = [
  "FAKTUROWNIA_API_TOKEN",
  "FAKTUROWNIA_SUBDOMAIN",
  "NEXT_PUBLIC_BASE_URL",
  "TEST_USER_EMAIL",
  "TEST_USER_PASSWORD",
];

function loadEnv(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const env = loadEnv(envPath);
let failed = false;

console.log("=== Weryfikacja środowiska testów manualnych ===\n");

if (!existsSync(envPath)) {
  console.log("BŁĄD: brak pliku .env.local w with-supabase-app/");
  process.exit(1);
}

console.log("Wymagane zmienne:");
for (const key of REQUIRED) {
  const ok = Boolean(env[key]?.trim());
  console.log(`  ${ok ? "OK" : "BRAK"}  ${key}`);
  if (!ok) failed = true;
}

console.log("\nOpcjonalne (faktury / logowanie testowe):");
for (const key of OPTIONAL) {
  const ok = Boolean(env[key]?.trim());
  console.log(`  ${ok ? "OK" : "—"}  ${key}`);
}

const baseUrl = env.NEXT_PUBLIC_BASE_URL?.trim() || "http://localhost:3000";
console.log(`\nSprawdzam ${baseUrl}/trip ...`);

try {
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/trip`, {
    signal: AbortSignal.timeout(8000),
  });
  console.log(`  HTTP ${res.status} ${res.ok ? "OK" : "BŁĄD"}`);
  if (!res.ok) failed = true;
} catch (e) {
  console.log(`  BŁĄD: ${e.message}`);
  console.log("  Uruchom: pnpm dev");
  failed = true;
}

console.log(
  failed
    ? "\n❌ Środowisko niegotowe — uzupełnij .env.local i uruchom dev server."
    : "\n✓ Środowisko gotowe do testów manualnych (patrz TESTY_MANUALNE.md)."
);
process.exit(failed ? 1 : 0);
