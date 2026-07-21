import os
import pandas as pd

path = r"c:\Users\sblic\Downloads\Wykaz_umow_szablony_do_eksportu_csv_23062026 (2).xlsx"
df = pd.read_excel(path, sheet_name="Lotniska", header=None, skiprows=2, names=["code", "name"])
df = df.dropna(subset=["code", "name"])
df["code"] = df["code"].astype(str).str.strip().str.upper()
df["name"] = df["name"].astype(str).str.strip()
df = df[df["code"].str.len() > 0]
df = df.drop_duplicates(subset=["code"])


def esc(s: str) -> str:
    return s.replace("'", "''")


out_path = os.path.join(
    os.path.dirname(__file__),
    "..",
    "supabase",
    "063_airports_seed.sql",
)
out_path = os.path.normpath(out_path)

with open(out_path, "w", encoding="utf-8") as f:
    f.write("-- Seed: slownik lotnisk COM-SL-0010-LOTNISKA\n")
    f.write("INSERT INTO public.airports (code, name) VALUES\n")
    rows = [f"  ('{esc(row['code'])}', '{esc(row['name'])}')" for _, row in df.iterrows()]
    f.write(",\n".join(rows))
    f.write("\nON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;\n")

print(f"Generated {len(df)} airports -> {out_path}")
print("File size KB:", os.path.getsize(out_path) // 1024)
