import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { hashToken, isValidTokenFormat } from "@/lib/token";
import { FeedbackForm } from "./feedback-form";

// Rendered per request: reads cookies / records a scan.
export const instant = false;

export const metadata: Metadata = {
  title: "Sana özel bir mesaj",
  robots: { index: false, follow: false },
};

// Link preview bots (WhatsApp, Telegram, ...) must not consume a message.
const BOT_UA = /bot|crawl|spider|preview|facebookexternalhit|whatsapp|telegram|slack|discord|skype/i;

type PickResult = {
  status: "ok" | "not_found" | "empty";
  message_id: number | null;
  message_text: string | null;
  author: string | null;
  is_new_round: boolean;
};

export default async function QrPage({ params }: PageProps<"/q/[token]">) {
  const { token } = await params;
  if (!isValidTokenFormat(token)) notFound();

  const ua = (await headers()).get("user-agent") ?? "";
  if (BOT_UA.test(ua)) {
    return (
      <main className="card">
        <h1>Sürpriz mesajın seni bekliyor</h1>
        <p className="hint">Mesajını görmek için QR kodu telefonunla okut.</p>
      </main>
    );
  }

  const { data, error } = await db().rpc("pick_message", { p_token_hash: hashToken(token) });
  if (error) throw error;
  const result = (data as PickResult[])[0];

  if (!result || result.status === "not_found") notFound();

  if (result.status === "empty") {
    return (
      <main className="card">
        <h1>Şimdilik mesaj yok</h1>
        <p className="hint">Yeni mesajlar çok yakında eklenecek.</p>
      </main>
    );
  }

  return (
    <main className="card">
      <p className="eyebrow">Sürpriz mesajın</p>
      <blockquote className="quote">
        <p>“{result.message_text}”</p>
        {result.author && <footer>— {result.author}</footer>}
      </blockquote>
      {result.is_new_round && (
        <p className="hint">Tüm mesajları gördün; şimdi yeni bir tura başladın.</p>
      )}
      <p className="hint">Bir sonraki okutmanda yeni bir mesaj seni bekliyor.</p>
      <FeedbackForm token={token} />
    </main>
  );
}
