import type { Metadata } from "next";
import Link from "next/link";
import { isAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { LoginForm } from "./login-form";
import { AdminShell, ScansTable, fmt, type ScanRow } from "./ui";

// Rendered per request: reads cookies.
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

type FeedbackRow = { id: number; message: string; created_at: string; keychain_id: number | null; keychains: { label: string } | null };

export default async function AdminPage() {
  if (!(await isAdmin())) return <LoginForm />;
  const client = db();

  const [stats, scans, feedback] = await Promise.all([
    client.rpc("admin_stats"),
    client.rpc("admin_scans", { p_limit: 20 }),
    client
      .from("feedback")
      .select("id, message, created_at, keychain_id, keychains(label)")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  for (const r of [stats, scans, feedback]) if (r.error) throw r.error;

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
  const feedbackRows = feedback.data as unknown as FeedbackRow[];

  return (
    <AdminShell active="overview" title="Özet" autoRefresh>
      <section>
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
        <div className="section-head">
          <h2>Son okutmalar</h2>
          <Link href="/admin/scans">Tümü →</Link>
        </div>
        <ScansTable rows={scans.data as ScanRow[]} />
      </section>

      <section>
        <h2>Son geri bildirimler</h2>
        {feedbackRows.length === 0 ? (
          <p className="muted">Henüz geri bildirim yok.</p>
        ) : (
          <table>
            <thead>
              <tr><th>Tarih</th><th>Anahtarlık</th><th>Mesaj</th></tr>
            </thead>
            <tbody>
              {feedbackRows.map((f) => (
                <tr key={f.id}>
                  <td className="nowrap">{fmt(f.created_at)}</td>
                  <td className="nowrap">
                    {f.keychain_id && f.keychains ? <Link href={`/admin/keychains/${f.keychain_id}`}>{f.keychains.label}</Link> : "—"}
                  </td>
                  <td>{f.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </AdminShell>
  );
}
