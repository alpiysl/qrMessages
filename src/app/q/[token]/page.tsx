import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { hashToken, isValidTokenFormat } from "@/lib/token";
import { NoteShell } from "../note";
import { FeedbackForm } from "./feedback-form";
import { Greeting } from "./greeting";

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
      <NoteShell>
        <p className="note-text">Bir mesajın var.</p>
        <p className="note-small">Görmek için QR kodu telefonunla okut.</p>
      </NoteShell>
    );
  }

  const { data, error } = await db().rpc("pick_message", { p_token_hash: hashToken(token) });
  if (error) throw error;
  const result = (data as PickResult[])[0];

  if (!result || result.status === "not_found") notFound();

  if (result.status === "empty") {
    return (
      <NoteShell>
        <p className="note-text">Şimdilik yeni bir not yok.</p>
        <p className="note-small">Yeni notlar yakında eklenecek, birazdan tekrar okut.</p>
      </NoteShell>
    );
  }

  return (
    <NoteShell
      above={<Greeting />}
      below={
        <div className="note-after">
          {result.is_new_round && <p>Tüm notları gördün, şimdi baştan başlıyoruz.</p>}
          <p>Bir dahaki okutmada yeni bir not seni bekliyor.</p>
          <FeedbackForm token={token} />
        </div>
      }
    >
      <blockquote>
        <p className="note-text">{result.message_text}</p>
        {result.author && <footer className="note-sign">{result.author}</footer>}
      </blockquote>
    </NoteShell>
  );
}
