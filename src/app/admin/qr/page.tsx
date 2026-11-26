import type { Metadata } from "next";
import Link from "next/link";
import { isAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { hasTokenKey } from "@/lib/token-crypto";
import { deleteBatch } from "../actions";
import { ConfirmButton } from "../confirm-button";
import { LoginForm } from "../login-form";
import { AdminShell, fmt } from "../ui";
import { CreateForm } from "./create-form";

export const instant = false;
export const metadata: Metadata = { title: "QR Üret", robots: { index: false, follow: false } };

type BatchRow = {
  id: number;
  prefix: string;
  count: number;
  qr_size_cm: number;
  created_at: string;
  first_label: string | null;
  last_label: string | null;
  remaining: number;
  printable: number;
};

export default async function QrPage() {
  if (!(await isAdmin())) return <LoginForm />;
  const { data, error } = await db().rpc("admin_batches");
  if (error) throw error;
  const batches = data as BatchRow[];

  return (
    <AdminShell title="QR Üret">
      <section>
        {hasTokenKey() ? <CreateForm /> : <p className="error">QR_TOKEN_KEY tanımlı değil. Vercel env&apos;e ekleyip redeploy et.</p>}
      </section>

      <section>
        <h2>Üretimler</h2>
        {batches.length === 0 ? (
          <p className="muted">Henüz üretim yok.</p>
        ) : (
          <table>
            <thead>
              <tr><th>#</th><th>Tarih</th><th>Etiketler</th><th>Adet</th><th>Boyut</th><th></th></tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id}>
                  <td>{b.id}</td>
                  <td className="nowrap">{fmt(b.created_at)}</td>
                  <td className="nowrap">
                    {b.first_label ? (
                      <Link href={`/admin/keychains?batch=${b.id}`}>{b.first_label} – {b.last_label}</Link>
                    ) : (
                      <span className="muted">{b.prefix} (silinmiş)</span>
                    )}
                  </td>
                  <td>{b.remaining}{b.remaining !== b.count && <span className="muted"> / {b.count}</span>}</td>
                  <td>{b.qr_size_cm} cm</td>
                  <td className="actions-row">
                    {b.printable > 0 && <a className="button secondary" href={`/admin/pdf?batch=${b.id}`}>PDF</a>}
                    <form action={deleteBatch}>
                      <input type="hidden" name="id" value={b.id} />
                      <ConfirmButton message={`Batch #${b.id}: ${b.remaining} anahtarlık ve okutma geçmişleri kalıcı olarak silinecek. Emin misin?`}>
                        Sil
                      </ConfirmButton>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </AdminShell>
  );
}
