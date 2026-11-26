"use server";

import { refresh, revalidatePath } from "next/cache";
import { checkPassword, createSession, destroySession, requireAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";

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

export async function setMessageActive(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const active = formData.get("active") === "true";
  const { error } = await db().from("messages").update({ active }).eq("id", id);
  if (error) throw error;
  revalidatePath("/admin");
}

export async function addMessage(formData: FormData) {
  await requireAdmin();
  const text = String(formData.get("text") ?? "").trim();
  const author = String(formData.get("author") ?? "").trim() || null;
  if (!text || text.length > 500) return;
  const { error } = await db().from("messages").insert({ text, author });
  if (error) throw error;
  revalidatePath("/admin");
}

export async function setKeychainStatus(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const status = formData.get("status") === "disabled" ? "disabled" : "active";
  const { error } = await db().from("keychains").update({ status }).eq("id", id);
  if (error) throw error;
  revalidatePath("/admin");
}
