import os

seed_path = os.path.join(os.path.dirname(__file__), "..", "supabase", "063_airports_seed.sql")
seed_path = os.path.normpath(seed_path)
batch_dir = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "supabase", "063_airports_seed_batches"))

with open(seed_path, encoding="utf-8") as f:
    content = f.read()

marker = "INSERT INTO public.airports (code, name) VALUES\n"
if marker not in content:
    raise SystemExit("Unexpected seed format")

_, rest = content.split(marker, 1)
rest = rest.strip()
if rest.endswith(";"):
    rest = rest[:-1]
conflict = "ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;"

if "\n" + conflict in rest:
    values_part = rest.rsplit("\n" + conflict, 1)[0]
else:
    values_part = rest.rsplit(conflict, 1)[0]

rows = []
for line in values_part.splitlines():
    line = line.strip()
    if not line or line.startswith("INSERT INTO"):
        continue
    rows.append(line.rstrip(","))

os.makedirs(batch_dir, exist_ok=True)
for old in os.listdir(batch_dir):
    os.remove(os.path.join(batch_dir, old))

batch_size = 400
batches = [rows[i : i + batch_size] for i in range(0, len(rows), batch_size)]

for i, batch in enumerate(batches, 1):
    out = os.path.join(batch_dir, f"batch_{i:02d}.sql")
    with open(out, "w", encoding="utf-8") as f:
        f.write(f"-- airports seed batch {i}/{len(batches)}\n")
        f.write("INSERT INTO public.airports (code, name) VALUES\n")
        f.write(",\n".join(batch))
        f.write(f"\n{conflict}\n")
    print(out, len(batch))

print(f"Total rows: {len(rows)}, batches: {len(batches)}")
