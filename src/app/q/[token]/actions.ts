"use server";

import { db } from "@/lib/db";
import { hashToken, isValidTokenFormat } from "@/lib/token";

export type FeedbackState = { status: "idle" | "ok" | "error"; message: string };

const MESSAGES: Record<string, string> = {
  ok: "Teşekkürler! Önerin bize ulaştı.",
  invalid: "Lütfen 1–1000 karakter arasında bir mesaj yaz.",
  rate_limited: "Çok sık gönderim yaptın, biraz sonra tekrar dene.",
  not_found: "Bu QR kod aktif değil.",
};

export async function submitFeedback(_prev: FeedbackState, formData: FormData): Promise<FeedbackState> {
  const token = String(formData.get("token") ?? "");
  const message = String(formData.get("message") ?? "");

  if (!isValidTokenFormat(token)) return { status: "error", message: MESSAGES.not_found };

  const { data, error } = await db().rpc("submit_feedback", {
    p_token_hash: hashToken(token),
    p_message: message,
  });
  if (error) return { status: "error", message: "Bir hata oluştu, lütfen tekrar dene." };

  const code = data as string;
  return { status: code === "ok" ? "ok" : "error", message: MESSAGES[code] ?? MESSAGES.invalid };
}
