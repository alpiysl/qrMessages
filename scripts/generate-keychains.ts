// Generates N keychains as one batch: token hash + encrypted token (QR_TOKEN_KEY) go to DB, QR images and a CSV for print.
// Use the same QR_TOKEN_KEY as the deployed app, otherwise the admin page cannot re-print these QR codes.
// Usage: npm run qr:generate -- --count 100 [--base-url https://example.com]
import { config } from "dotenv";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";
import QRCode from "qrcode";
import { createKeychains } from "../src/lib/keychain-factory";

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

async function main() {
  const { keychains: rows } = await createKeychains(supabase, {
    count,
    prefix: values.prefix!,
    baseUrl,
    maxCount: 10000,
  });

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
