// Generates N keychains: random tokens (only hashes go to DB), QR images and a CSV for print.
// Usage: npm run qr:generate -- --count 100 [--base-url https://example.com]
import { config } from "dotenv";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";
import QRCode from "qrcode";
import { generateToken, hashToken } from "../src/lib/token";

config({ path: ".env.local", quiet: true });

const { values } = parseArgs({
  options: {
    count: { type: "string", default: "100" },
    "base-url": { type: "string" },
    prefix: { type: "string", default: "KC" },
  },
});

const count = Number(values.count);
const baseUrl = (values["base-url"] ?? process.env.PUBLIC_BASE_URL ?? "").replace(/\/+$/, "");
if (!Number.isInteger(count) || count < 1 || count > 10000) throw new Error("--count must be 1..10000");
if (!/^https?:\/\//.test(baseUrl)) throw new Error("Set --base-url or PUBLIC_BASE_URL");

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false },
});

async function nextNumber(prefix: string): Promise<number> {
  const { data, error } = await supabase
    .from("keychains")
    .select("label")
    .like("label", `${prefix}-%`)
    .order("label", { ascending: false })
    .limit(1);
  if (error) throw error;
  return data.length ? Number(data[0].label.split("-").pop()) + 1 : 1;
}

async function main() {
  const prefix = values.prefix!;
  const start = await nextNumber(prefix);
  const rows = Array.from({ length: count }, (_, i) => {
    const token = generateToken();
    const label = `${prefix}-${String(start + i).padStart(5, "0")}`;
    return { label, token, url: `${baseUrl}/q/${token}` };
  });

  const { error } = await supabase
    .from("keychains")
    .insert(rows.map((r) => ({ label: r.label, token_hash: hashToken(r.token) })));
  if (error) throw error;

  const batch = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = join("qr-output", batch);
  mkdirSync(join(dir, "svg"), { recursive: true });
  mkdirSync(join(dir, "png"), { recursive: true });

  for (const r of rows) {
    const opts = { errorCorrectionLevel: "M" as const, margin: 2 };
    writeFileSync(join(dir, "svg", `${r.label}.svg`), await QRCode.toString(r.url, { ...opts, type: "svg" }));
    await QRCode.toFile(join(dir, "png", `${r.label}.png`), r.url, { ...opts, width: 1024 });
  }

  const csv = ["label,url", ...rows.map((r) => `${r.label},${r.url}`)].join("\n") + "\n";
  writeFileSync(join(dir, "keychains.csv"), csv);

  console.log(`Created ${rows.length} keychains (${rows[0].label} .. ${rows.at(-1)!.label})`);
  console.log(`Output: ${dir}`);
  console.log("CSV contains raw tokens: keep it private.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
