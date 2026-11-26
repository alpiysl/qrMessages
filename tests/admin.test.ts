import { config } from "dotenv";
import { afterAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument } from "pdf-lib";
import { parseMessagesCsv } from "../src/lib/csv";
import { createKeychains } from "../src/lib/keychain-factory";
import { renderQrPdf } from "../src/lib/pdf";
import { hashToken } from "../src/lib/token";
import { decryptToken, encryptToken } from "../src/lib/token-crypto";

config({ path: ".env.local", quiet: true });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false },
});

const batches: number[] = [];

afterAll(async () => {
  for (const id of batches) {
    await supabase.from("keychains").delete().eq("batch_id", id);
    await supabase.from("batches").delete().eq("id", id);
  }
});

describe("token-crypto", () => {
  it("round-trips and rejects a different key", () => {
    const enc = encryptToken("abc_DEF-123");
    expect(enc).not.toContain("abc_DEF-123");
    expect(decryptToken(enc)).toBe("abc_DEF-123");

    const original = process.env.QR_TOKEN_KEY;
    process.env.QR_TOKEN_KEY = Buffer.alloc(32, 7).toString("base64");
    try {
      expect(() => decryptToken(enc)).toThrow();
    } finally {
      process.env.QR_TOKEN_KEY = original;
    }
  });
});

describe("parseMessagesCsv", () => {
  it("handles header, quotes, commas, semicolons and invalid rows", () => {
    const { rows, invalid } = parseMessagesCsv(
      'text,author\n"Uçamıyorsan koş, yürü; ilerle.",MLK\nTek satır\n"",Boş\n"Tırnak ""içinde""",\n',
    );
    expect(rows).toEqual([
      { text: "Uçamıyorsan koş, yürü; ilerle.", author: "MLK" },
      { text: "Tek satır", author: null },
      { text: 'Tırnak "içinde"', author: null },
    ]);
    expect(invalid).toBe(1);
  });
});

describe("createKeychains + admin queries", () => {
  it("creates a batch with decryptable tokens and reports scans per keychain", async () => {
    const { batchId, keychains } = await createKeychains(supabase, {
      count: 2, prefix: "VT", baseUrl: "http://localhost:3000",
    });
    batches.push(batchId);
    expect(keychains[0].label).toMatch(/^VT-\d{5}$/);

    const { data: stored } = await supabase.from("keychains").select("token_hash, token_enc").eq("id", keychains[0].id).single();
    expect(hashToken(decryptToken(stored!.token_enc))).toBe(stored!.token_hash);

    const { data: pick } = await supabase.rpc("pick_message", { p_token_hash: hashToken(keychains[0].token) });
    const { data: scans } = await supabase.rpc("admin_scans", { p_keychain_id: keychains[0].id });
    expect(scans).toHaveLength(1);
    expect(scans[0]).toMatchObject({ label: keychains[0].label, message_id: pick[0].message_id, round: 1, total: 1 });

    const { data: list } = await supabase.rpc("admin_keychains", { p_batch_id: batchId });
    const first = list.find((k: { id: number }) => k.id === keychains[0].id);
    expect(first).toMatchObject({ scans: 1, has_token: true, last_message: pick[0].message_text, total: 2 });

    const { data: msgs } = await supabase.rpc("admin_messages", { p_search: pick[0].message_text });
    expect(msgs[0].views).toBeGreaterThanOrEqual(1);
  });

  it("rejects counts above the admin limit", async () => {
    await expect(createKeychains(supabase, { count: 31, prefix: "VT", baseUrl: "http://x" })).rejects.toThrow();
  });

  it("deleting a keychain removes its scans and anonymises its feedback", async () => {
    const { batchId, keychains } = await createKeychains(supabase, { count: 1, prefix: "VT", baseUrl: "http://localhost:3000" });
    batches.push(batchId);
    const k = keychains[0];
    await supabase.rpc("pick_message", { p_token_hash: hashToken(k.token) });
    await supabase.rpc("submit_feedback", { p_token_hash: hashToken(k.token), p_message: "silme testi" });

    await supabase.from("keychains").delete().eq("id", k.id);
    const { count: views } = await supabase.from("message_views").select("*", { count: "exact", head: true }).eq("keychain_id", k.id);
    expect(views).toBe(0);
    const { data: fb } = await supabase.from("feedback").select("id, keychain_id").eq("message", "silme testi");
    expect(fb!.length).toBeGreaterThan(0);
    expect(fb!.every((f) => f.keychain_id === null)).toBe(true);
    await supabase.from("feedback").delete().eq("message", "silme testi");
  });
});

describe("renderQrPdf", () => {
  it("fits more QR codes per A4 page when smaller", async () => {
    const items = Array.from({ length: 30 }, (_, i) => ({ label: `KC-${i}`, url: `https://example.com/q/${"a".repeat(32)}` }));
    const pages = async (size: number) => (await PDFDocument.load(await renderQrPdf(items, size))).getPageCount();
    expect(await pages(2)).toBe(1);
    expect(await pages(4)).toBeGreaterThan(1);
  });
});
