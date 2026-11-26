// Backfills keychains.token_enc from earlier keychains.csv exports so old QR codes can be re-printed.
// Only rows whose token hash matches the stored hash are updated.
// Usage: npm run qr:import-tokens -- qr-output/<batch>/keychains.csv [more.csv ...]
import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { hashToken } from "../src/lib/token";
import { encryptToken } from "../src/lib/token-crypto";

config({ path: ".env.local", quiet: true });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false },
});

async function main() {
  const files = process.argv.slice(2);
  if (!files.length) throw new Error("Pass one or more keychains.csv files");
  let updated = 0;
  let skipped = 0;

  for (const file of files) {
    const lines = readFileSync(file, "utf8").trim().split("\n").slice(1);
    for (const line of lines) {
      const [label, url] = line.split(",");
      const token = url?.split("/q/")[1]?.trim();
      if (!label || !token) continue;
      const { data, error } = await supabase
        .from("keychains")
        .update({ token_enc: encryptToken(token) })
        .eq("label", label)
        .eq("token_hash", hashToken(token))
        .select("id");
      if (error) throw error;
      if (data.length) updated++;
      else skipped++;
    }
  }
  console.log(`Updated ${updated}, skipped ${skipped} (not in this DB or hash mismatch)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
