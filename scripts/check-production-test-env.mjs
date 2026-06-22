#!/usr/bin/env node
/**
 * Weryfikacja środowiska przed testami E2E na produkcji / Vercel.
 * Uruchom: pnpm test:e2e:production:env
 */
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const envPath = resolve(root, ".env.production.test");

const REQUIRED = ["TEST_USER_EMAIL", "TEST_USER_PASSWORD"];

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

const fileEnv = loadEnv(envPath);
const env = { ...fileEnv, ...process.env };
let failed = false;

console.log("=== Weryfikacja środowiska testów produkcyjnych ===\n");

if (!existsSync(envPath)) {
  console.log("BŁĄD: brak pliku .env.production.test");
  console.log("Skopiuj .env.production.test.example → .env.production.test i uzupełnij hasło (DANE.md).");
  process.exit(1);
}

const baseUrl = env.PLAYWRIGHT_BASE_URL?.trim() || "https://magia-pod.vercel.app";
console.log(`Adres aplikacji: ${baseUrl}\n`);

console.log("Wymagane zmienne:");
for (const key of REQUIRED) {
  const ok = Boolean(env[key]?.trim());
  console.log(`  ${ok ? "OK" : "BRAK"}  ${key}`);
  if (!ok) failed = true;
}

const optionalSlug = env.PRODUCTION_TRIP_SLUG?.trim();
console.log(`\nOpcjonalne:`);
console.log(`  ${optionalSlug ? "OK" : "—"}  PRODUCTION_TRIP_SLUG`);

const paths = ["/", "/trip", "/auth/login"];
console.log("\nSprawdzam HTTP:");
for (const p of paths) {
  const url = `${baseUrl.replace(/\/$/, "")}${p}`;
  try {
    const res = await fetch(url, { redirect: "follow" });
    const ok = res.status >= 200 && res.status < 400;
    console.log(`  ${ok ? "OK" : "BŁĄD"}  ${url} → ${res.status}`);
    if (!ok) failed = true;
  } catch (e) {
    console.log(`  BŁĄD  ${url} → ${e.message}`);
    failed = true;
  }
}

if (failed) {
  console.log("\n✗ Środowisko niegotowe. Popraw .env.production.test i dostępność serwera.");
  process.exit(1);
}

console.log("\n✓ Gotowe do: pnpm test:e2e:production");
console.log("  Testy są read-only (bez tworzenia wycieczek/rezerwacji na produkcji).");
