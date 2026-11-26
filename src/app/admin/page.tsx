import type { Metadata } from "next";
import { isAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { addMessage, logout, setKeychainStatus, setMessageActive } from "./actions";
import { LoginForm } from "./login-form";

// Rendered per request: reads cookies / records a scan.
export const instant = false;

export const metadata: Metadata = { title: "Yönetim", robots: { index: false, follow: false } };

type Stats = {
  keychains_total: number;
  keychains_active: number;
  keychains_disabled: number;
  scans_total: number;
  scans_last_7_days: number;
  scanned_keychains: number;
  repeat_keychains: number;
  avg_scans_per_scanned_keychain: number;
  messages_active: number;
  feedback_total: number;
};

type KeychainRow = {
  id: number;
  label: string;
  status: "generated" | "active" | "disabled";
  scans: number;
  last_scan: string | null;
};

type MessageRow = { id: number; text: string; author: string | null; active: boolean };
type FeedbackRow = { id: number; message: string; created_at: string; keychains: { label: string } | null };

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" }) : "—";

export default async function AdminPage() {
  if (!(await isAdmin())) return <LoginForm />;
  const client = db();

  const [stats, keychains, messages, feedback] = await Promise.all([
    client.rpc("admin_stats"),
    client.rpc("admin_keychains"),
    client.from("messages").select("id, text, author, active").order("id"),
    client
      .from("feedback")
      .select("id, message, created_at, keychains(label)")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  for (const r of [stats, keychains, messages, feedback]) if (r.error) throw r.error;

  const s = stats.data as Stats;
  const repeatRate = s.scanned_keychains ? Math.round((s.repeat_keychains / s.scanned_keychains) * 100) : 0;

  const statItems: [string, string | number][] = [
    ["Toplam anahtarlık", s.keychains_total],
    ["Aktif (okutulmuş)", s.keychains_active],
    ["Devre dışı", s.keychains_disabled],
    ["Toplam okutma", s.scans_total],
    ["Son 7 gün okutma", s.scans_last_7_days],
    ["Tekrar okutma oranı", `%${repeatRate}`],
    ["Okutulan başına ort.", s.avg_scans_per_scanned_keychain],
    ["Aktif mesaj", s.messages_active],
    ["Geri bildirim", s.feedback_total],
  ];

  return (
    <div className="admin">
      <header>
        <h1>Yönetim</h1>
        <form action={logout}>
          <button className="secondary">Çıkış</button>
        </form>
      </header>

      <section>
        <h2>İstatistikler</h2>
        <div className="stats">
          {statItems.map(([label, value]) => (
            <div className="stat" key={label}>
              <b>{value}</b>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2>Geri bildirimler</h2>
        {(feedback.data as unknown as FeedbackRow[]).length === 0 ? (
          <p className="muted">Henüz geri bildirim yok.</p>
        ) : (
          <table>
            <thead>
              <tr><th>Tarih</th><th>Anahtarlık</th><th>Mesaj</th></tr>
            </thead>
            <tbody>
              {(feedback.data as unknown as FeedbackRow[]).map((f) => (
                <tr key={f.id}>
                  <td>{fmt(f.created_at)}</td>
                  <td>{f.keychains?.label ?? "—"}</td>
                  <td>{f.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2>Mesajlar</h2>
        <table>
          <thead>
            <tr><th>#</th><th>Mesaj</th><th>Yazar</th><th>Durum</th></tr>
          </thead>
          <tbody>
            {(messages.data as MessageRow[]).map((m) => (
              <tr key={m.id}>
                <td>{m.id}</td>
                <td>{m.text}</td>
                <td>{m.author ?? "—"}</td>
                <td>
                  <form action={setMessageActive}>
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="active" value={String(!m.active)} />
                    <button className="secondary">{m.active ? "Aktif ✓" : "Pasif"}</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <form action={addMessage} className="inline-form">
          <input type="text" name="text" placeholder="Yeni mesaj" maxLength={500} required />
          <input type="text" name="author" placeholder="Yazar (opsiyonel)" maxLength={100} />
          <button>Ekle</button>
        </form>
      </section>

      <section>
        <h2>Anahtarlıklar</h2>
        <table>
          <thead>
            <tr><th>Etiket</th><th>Durum</th><th>Okutma</th><th>Son okutma</th><th></th></tr>
          </thead>
          <tbody>
            {(keychains.data as KeychainRow[]).map((k) => (
              <tr key={k.id}>
                <td>{k.label}</td>
                <td>{k.status}</td>
                <td>{k.scans}</td>
                <td>{fmt(k.last_scan)}</td>
                <td>
                  <form action={setKeychainStatus}>
                    <input type="hidden" name="id" value={k.id} />
                    <input type="hidden" name="status" value={k.status === "disabled" ? "active" : "disabled"} />
                    <button className="secondary">{k.status === "disabled" ? "Etkinleştir" : "Devre dışı bırak"}</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
