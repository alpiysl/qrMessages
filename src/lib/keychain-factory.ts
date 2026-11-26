import type { SupabaseClient } from "@supabase/supabase-js";
import { encryptToken } from "./token-crypto";
import { generateToken, hashToken } from "./token";

// Shared by the admin QR page and the CLI script. Kept free of "server-only" so tsx scripts can import it.

export const MAX_BATCH = 30;
export const QR_SIZES_CM = [2, 3, 4] as const;

export type CreatedKeychain = { id: number; label: string; token: string; url: string };

export function normalizePrefix(raw: string): string {
  const p = raw.trim().toUpperCase();
  if (!/^[A-Z0-9]{1,10}$/.test(p)) throw new Error("Önek 1-10 karakter, sadece harf/rakam olmalı");
  return p;
}

export function keychainUrl(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/q/${token}`;
}

async function nextNumber(db: SupabaseClient, prefix: string): Promise<number> {
  const { data, error } = await db
    .from("keychains")
    .select("label")
    .like("label", `${prefix}-%`)
    .order("label", { ascending: false })
    .limit(1);
  if (error) throw error;
  const n = data.length ? Number(data[0].label.split("-").pop()) : 0;
  return (Number.isFinite(n) ? n : 0) + 1;
}

export async function createKeychains(
  db: SupabaseClient,
  opts: { count: number; prefix: string; baseUrl: string; qrSizeCm?: number; maxCount?: number },
): Promise<{ batchId: number; keychains: CreatedKeychain[] }> {
  const max = opts.maxCount ?? MAX_BATCH;
  if (!Number.isInteger(opts.count) || opts.count < 1 || opts.count > max) {
    throw new Error(`Adet 1-${max} arası olmalı`);
  }
  if (!/^https?:\/\//.test(opts.baseUrl)) throw new Error("Base URL http(s) ile başlamalı");
  const prefix = normalizePrefix(opts.prefix);

  const { data: batch, error: batchError } = await db
    .from("batches")
    .insert({ prefix, count: opts.count, qr_size_cm: opts.qrSizeCm ?? 3 })
    .select("id")
    .single();
  if (batchError) throw batchError;

  const start = await nextNumber(db, prefix);
  const rows = Array.from({ length: opts.count }, (_, i) => {
    const token = generateToken();
    return { label: `${prefix}-${String(start + i).padStart(5, "0")}`, token };
  });

  const { data, error } = await db
    .from("keychains")
    .insert(rows.map((r) => ({
      label: r.label,
      token_hash: hashToken(r.token),
      token_enc: encryptToken(r.token),
      batch_id: batch.id,
    })))
    .select("id, label");
  if (error) {
    await db.from("batches").delete().eq("id", batch.id);
    throw error;
  }

  const ids = new Map(data.map((d) => [d.label as string, d.id as number]));
  return {
    batchId: batch.id,
    keychains: rows.map((r) => ({ id: ids.get(r.label)!, label: r.label, token: r.token, url: keychainUrl(opts.baseUrl, r.token) })),
  };
}
