#!/usr/bin/env node
/**
 * Tworzy / aktualizuje konta adminów w Supabase Auth + profiles.
 *
 * Uruchom z katalogu with-supabase-app:
 *   node scripts/ensure-admins.mjs
 *
 * Opcjonalnie wspólne hasło startowe (tylko dla NOWYCH kont):
 *   ADMIN_INITIAL_PASSWORD="TwojeHaslo123!" node scripts/ensure-admins.mjs
 *
 * Dla istniejących kont tylko ustawia role=admin (hasła nie zmienia).
 */
import { readFileSync, existsSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const envPath = resolve(root, ".env.local");

const ADMIN_EMAILS = [
  "grupa.depl@gmail.com",
  "michal.grzenia@gmail.com",
  "michal.depl@gmail.com",
  "karmen.depl@gmail.com",
  "karolina.depl@gmail.com",
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

function generatePassword() {
  // czytelne hasło startowe: litery+cyfry, bez mylenia znaków
  return randomBytes(12).toString("base64url").slice(0, 16) + "Aa1!";
}

async function findUserByEmail(admin, email) {
  // listUsers jest paginowany — przejdź kilka stron
  const perPage = 200;
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users ?? [];
    const found = users.find(
      (u) => (u.email || "").toLowerCase() === email.toLowerCase(),
    );
    if (found) return found;
    if (users.length < perPage) break;
  }
  return null;
}

async function ensureProfile(admin, userId, email) {
  const payload = {
    id: userId,
    role: "admin",
    allowed_trip_ids: null,
  };

  // Najpierw spróbuj z email (niektóre schematy mają tę kolumnę)
  let { error } = await admin.from("profiles").upsert(
    { ...payload, email },
    { onConflict: "id" },
  );

  if (error && /email|column/i.test(error.message || "")) {
    ({ error } = await admin.from("profiles").upsert(payload, { onConflict: "id" }));
  }

  if (error) {
    // fallback: update jeśli wiersz istnieje, insert jeśli nie
    const { data: existing } = await admin
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (existing) {
      const { error: updErr } = await admin
        .from("profiles")
        .update({ role: "admin", allowed_trip_ids: null })
        .eq("id", userId);
      if (updErr) throw updErr;
    } else {
      const { error: insErr } = await admin.from("profiles").insert(payload);
      if (insErr) throw insErr;
    }
  }
}

async function main() {
  const fileEnv = loadEnv(envPath);
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL || fileEnv.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || fileEnv.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error(
      "Brak NEXT_PUBLIC_SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY (.env.local).",
    );
    process.exit(1);
  }

  const defaultPassword =
    process.env.ADMIN_INITIAL_PASSWORD?.trim() || null;

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(`Supabase: ${url}`);
  console.log(`Kont: ${ADMIN_EMAILS.length}\n`);

  const credentialsCreated = [];

  for (const email of ADMIN_EMAILS) {
    process.stdout.write(`→ ${email} ... `);
    try {
      let user = await findUserByEmail(admin, email);
      let created = false;
      let password = null;

      if (!user) {
        password = defaultPassword || generatePassword();
        const { data, error } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { role: "admin" },
        });
        if (error) throw error;
        user = data.user;
        created = true;
        credentialsCreated.push({ email, password });
      }

      await ensureProfile(admin, user.id, email);

      const { data: profile, error: profErr } = await admin
        .from("profiles")
        .select("id, role")
        .eq("id", user.id)
        .single();

      if (profErr) throw profErr;
      if (profile.role !== "admin") {
        throw new Error(`Profil ma role="${profile.role}", oczekiwano admin`);
      }

      console.log(
        created
          ? `UTWORZONO + admin (id=${user.id})`
          : `istniejący + role=admin (id=${user.id})`,
      );
    } catch (e) {
      console.log(`BŁĄD: ${e.message || e}`);
    }
  }

  if (credentialsCreated.length > 0) {
    const outPath = resolve(root, "scripts", ".admin-credentials-ONCE.txt");
    const lines = [
      "# HASŁA STARTOWE — przekaż właścicielom i USUŃ ten plik",
      `# wygenerowano: ${new Date().toISOString()}`,
      "",
      ...credentialsCreated.map((c) => `${c.email}\t${c.password}`),
      "",
    ];
    writeFileSync(outPath, lines.join("\n"), "utf8");
    console.log(
      `\nUtworzono ${credentialsCreated.length} nowych kont. Hasła zapisane w:\n  ${outPath}\nPrzekaż je użytkownikom i usuń plik.`,
    );
  } else {
    console.log(
      "\nWszystkie konta już istniały — ustawiono tylko role=admin (haseł nie zmieniano).",
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
