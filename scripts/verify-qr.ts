// Verifies a generated batch without consuming messages:
// decodes every PNG, compares it with the CSV URL and checks the token hash exists in DB.
// Usage: npm run qr:verify -- qr-output/<batch>
import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import { hashToken } from "../src/lib/token";

config({ path: ".env.local", quiet: true });

const dir = process.argv[2];
if (!dir) throw new Error("Usage: npm run qr:verify -- qr-output/<batch>");

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false },
});

async function main() {
  const lines = readFileSync(join(dir, "keychains.csv"), "utf8").trim().split("\n").slice(1);
  const rows = lines.map((l) => {
    const [label, url] = l.split(",");
    return { label, url, token: url.split("/q/")[1] };
  });

  const { data, error } = await supabase
    .from("keychains")
    .select("label, token_hash")
    .in("label", rows.map((r) => r.label));
  if (error) throw error;
  const dbHash = new Map(data.map((d) => [d.label, d.token_hash]));

  const failures: string[] = [];
  for (const r of rows) {
    const png = PNG.sync.read(readFileSync(join(dir, "png", `${r.label}.png`)));
    const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data;
    if (decoded !== r.url) failures.push(`${r.label}: PNG decodes to ${decoded ?? "nothing"}`);
    if (dbHash.get(r.label) !== hashToken(r.token)) failures.push(`${r.label}: token hash mismatch / missing in DB`);
  }

  if (failures.length) {
    console.error(failures.join("\n"));
    console.error(`FAILED: ${failures.length} problem(s) in ${rows.length} keychains`);
    process.exit(1);
  }
  console.log(`OK: ${rows.length} keychains verified (QR decode + DB hash)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
