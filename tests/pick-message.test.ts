import { config } from "dotenv";
import { afterAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { generateToken, hashToken } from "../src/lib/token";

config({ path: ".env.local", quiet: true });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false },
});

const created: number[] = [];

async function newKeychain(): Promise<string> {
  const token = generateToken();
  const { data, error } = await supabase
    .from("keychains")
    .insert({ label: `TEST-${token.slice(0, 10)}`, token_hash: hashToken(token) })
    .select("id")
    .single();
  if (error) throw error;
  created.push(data.id);
  return token;
}

async function scan(token: string) {
  const { data, error } = await supabase.rpc("pick_message", { p_token_hash: hashToken(token) });
  if (error) throw error;
  return data[0] as { status: string; message_id: number; is_new_round: boolean };
}

async function activeMessageCount(): Promise<number> {
  const { count, error } = await supabase.from("messages").select("*", { count: "exact", head: true }).eq("active", true);
  if (error) throw error;
  return count!;
}

afterAll(async () => {
  if (!created.length) return;
  await supabase.from("feedback").delete().in("keychain_id", created);
  await supabase.from("keychains").delete().in("id", created);
});

describe("pick_message", () => {
  it("shows every active message once before repeating, then starts a new round without repeating the last one", async () => {
    const total = await activeMessageCount();
    const token = await newKeychain();

    const seen: number[] = [];
    for (let i = 0; i < total; i++) {
      const r = await scan(token);
      expect(r.status).toBe("ok");
      expect(r.is_new_round).toBe(false);
      seen.push(r.message_id);
    }
    expect(new Set(seen).size).toBe(total);

    const next = await scan(token);
    expect(next.is_new_round).toBe(true);
    expect(next.message_id).not.toBe(seen.at(-1));
  });

  it("keeps histories of different keychains independent", async () => {
    const a = await newKeychain();
    const b = await newKeychain();
    for (let i = 0; i < 3; i++) await scan(a);

    const total = await activeMessageCount();
    const seenB = new Set<number>();
    for (let i = 0; i < total; i++) seenB.add((await scan(b)).message_id);
    expect(seenB.size).toBe(total);
  });

  it("does not hand out duplicates under concurrent scans", async () => {
    const total = await activeMessageCount();
    const token = await newKeychain();
    const results = await Promise.all(Array.from({ length: total }, () => scan(token)));
    expect(new Set(results.map((r) => r.message_id)).size).toBe(total);
  });

  it("returns not_found for unknown and disabled keychains", async () => {
    expect((await scan(generateToken())).status).toBe("not_found");

    const token = await newKeychain();
    await supabase.from("keychains").update({ status: "disabled" }).eq("token_hash", hashToken(token));
    expect((await scan(token)).status).toBe("not_found");
  });

  it("activates a generated keychain on first scan", async () => {
    const token = await newKeychain();
    await scan(token);
    const { data } = await supabase.from("keychains").select("status").eq("token_hash", hashToken(token)).single();
    expect(data!.status).toBe("active");
  });
});

describe("submit_feedback", () => {
  it("rate limits to 3 entries per keychain per 10 minutes", async () => {
    const token = await newKeychain();
    const send = async (msg: string) =>
      (await supabase.rpc("submit_feedback", { p_token_hash: hashToken(token), p_message: msg })).data;

    expect(await send("   ")).toBe("invalid");
    expect(await send("bir")).toBe("ok");
    expect(await send("iki")).toBe("ok");
    expect(await send("üç")).toBe("ok");
    expect(await send("dört")).toBe("rate_limited");
  });
});
