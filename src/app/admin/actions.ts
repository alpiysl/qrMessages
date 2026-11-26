"use server";

import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { checkPassword, createSession, destroySession, requireAdmin } from "@/lib/admin-auth";
import { baseUrlFromRequest } from "@/lib/base-url";
import { db } from "@/lib/db";
import { MAX_BATCH, QR_SIZES_CM, createKeychains } from "@/lib/keychain-factory";
import { hasTokenKey } from "@/lib/token-crypto";
import { parseMessagesCsv } from "@/lib/csv";

const touch = () => revalidatePath("/admin", "layout");

const ids = (formData: FormData) =>
  formData.getAll("ids").map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 1000);

// --- Auth ---

export async function login(_prev: { error: string }, formData: FormData) {
  const password = String(formData.get("password") ?? "");
  if (!checkPassword(password)) {
    await new Promise((r) => setTimeout(r, 750));
    return { error: "Şifre hatalı." };
  }
  await createSession();
  refresh();
  return { error: "" };
}

export async function logout() {
  await destroySession();
  refresh();
}

// --- Messages ---

function messageFields(formData: FormData) {
  const text = String(formData.get("text") ?? "").trim();
  const author = String(formData.get("author") ?? "").trim().slice(0, 100) || null;
  if (!text || text.length > 500) throw new Error("Mesaj 1-500 karakter olmalı");
  return { text, author };
}

export async function setMessageActive(formData: FormData) {
  await requireAdmin();
  const { error } = await db()
    .from("messages")
    .update({ active: formData.get("active") === "true" })
    .eq("id", Number(formData.get("id")));
  if (error) throw error;
  touch();
}

export async function addMessage(formData: FormData) {
  await requireAdmin();
  const { error } = await db().from("messages").insert(messageFields(formData));
  if (error) throw error;
  touch();
}

export async function updateMessage(formData: FormData) {
  await requireAdmin();
  const { error } = await db().from("messages").update(messageFields(formData)).eq("id", Number(formData.get("id")));
  if (error) throw error;
  touch();
}

export async function importMessages(_prev: { result: string }, formData: FormData) {
  await requireAdmin();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { result: "Dosya seçilmedi." };
  if (file.size > 1_000_000) return { result: "Dosya 1 MB'tan büyük olamaz." };

  const { rows, invalid } = parseMessagesCsv(await file.text());
  if (!rows.length) return { result: `Geçerli satır bulunamadı (${invalid} geçersiz).` };

  const client = db();
  const { data: existing, error: readError } = await client.from("messages").select("text");
  if (readError) throw readError;
  const known = new Set(existing.map((m) => m.text.trim().toLowerCase()));
  const fresh = rows.filter((r) => {
    const k = r.text.toLowerCase();
    if (known.has(k)) return false;
    known.add(k);
    return true;
  });

  if (fresh.length) {
    const { error } = await client.from("messages").insert(fresh);
    if (error) throw error;
  }
  touch();
  return { result: `${fresh.length} mesaj eklendi, ${rows.length - fresh.length} tekrar atlandı, ${invalid} geçersiz satır.` };
}

// --- Keychains ---

export async function setKeychainStatus(formData: FormData) {
  await requireAdmin();
  const status = formData.get("status") === "disabled" ? "disabled" : "active";
  const { error } = await db().from("keychains").update({ status }).eq("id", Number(formData.get("id")));
  if (error) throw error;
  touch();
}

export async function deleteKeychain(formData: FormData) {
  await requireAdmin();
  const { error } = await db().from("keychains").delete().eq("id", Number(formData.get("id")));
  if (error) throw error;
  touch();
  redirect("/admin/keychains");
}

export async function bulkKeychains(formData: FormData) {
  await requireAdmin();
  const selected = ids(formData);
  if (!selected.length) return;
  const op = formData.get("op");
  const table = db().from("keychains");
  const { error } =
    op === "delete"
      ? await table.delete().in("id", selected)
      : op === "disable" || op === "enable"
        ? await table.update({ status: op === "disable" ? "disabled" : "active" }).in("id", selected)
        : { error: null };
  if (error) throw error;
  touch();
}

// --- QR batches ---

export type CreateBatchState = { error: string; batchId?: number; labels?: string };

export async function createBatch(_prev: CreateBatchState, formData: FormData): Promise<CreateBatchState> {
  await requireAdmin();
  if (!hasTokenKey()) return { error: "QR_TOKEN_KEY tanımlı değil (Vercel env). PDF için gerekli." };
  const count = Number(formData.get("count"));
  const size = Number(formData.get("size"));
  if (!Number.isInteger(count) || count < 1 || count > MAX_BATCH) return { error: `Adet 1-${MAX_BATCH} arası olmalı.` };
  if (!QR_SIZES_CM.includes(size as (typeof QR_SIZES_CM)[number])) return { error: "Geçersiz QR boyutu." };

  try {
    const { batchId, keychains } = await createKeychains(db(), {
      count,
      prefix: String(formData.get("prefix") ?? "KC"),
      baseUrl: await baseUrlFromRequest(),
      qrSizeCm: size,
    });
    touch();
    return { error: "", batchId, labels: `${keychains[0].label} – ${keychains.at(-1)!.label}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Üretim başarısız." };
  }
}

export async function deleteBatch(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const client = db();
  const { error } = await client.from("keychains").delete().eq("batch_id", id);
  if (error) throw error;
  const { error: batchError } = await client.from("batches").delete().eq("id", id);
  if (batchError) throw batchError;
  touch();
}
