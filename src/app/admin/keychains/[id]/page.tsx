import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { deleteKeychain, setKeychainStatus } from "../../actions";
import { ConfirmButton } from "../../confirm-button";
import { LoginForm } from "../../login-form";
import { AdminShell, PAGE_SIZE, Pager, STATUS_LABEL, ScansTable, fmt, pageNumber, type ScanRow } from "../../ui";

export const instant = false;
export const metadata: Metadata = { title: "Anahtarlık", robots: { index: false, follow: false } };

export default async function KeychainPage({ params, searchParams }: PageProps<"/admin/keychains/[id]">) {
  if (!(await isAdmin())) return <LoginForm />;
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) notFound();
  const page = pageNumber((await searchParams).page);

  const client = db();
  const [keychain, scans, feedback] = await Promise.all([
    client
      .from("keychains")
      .select("id, label, status, current_round, created_at, activated_at, batch_id, token_enc")
      .eq("id", id)
      .maybeSingle(),
    client.rpc("admin_scans", { p_keychain_id: id, p_limit: PAGE_SIZE, p_offset: (page - 1) * PAGE_SIZE }),
    client.from("feedback").select("id, message, created_at").eq("keychain_id", id).order("created_at", { ascending: false }),
  ]);
  for (const r of [keychain, scans, feedback]) if (r.error) throw r.error;
  const k = keychain.data;
  if (!k) notFound();
  const rows = scans.data as ScanRow[];
  const total = rows[0]?.total ?? 0;

  return (
    <AdminShell title={k.label} autoRefresh>
      <section>
        <dl className="facts">
          <div><dt>Durum</dt><dd>{STATUS_LABEL[k.status as keyof typeof STATUS_LABEL]}</dd></div>
          <div><dt>Toplam okutma</dt><dd>{total}</dd></div>
          <div><dt>Tur</dt><dd>{k.current_round}</dd></div>
          <div><dt>Üretim</dt><dd>{fmt(k.created_at)}{k.batch_id && <> · <Link href={`/admin/keychains?batch=${k.batch_id}`}>Batch #{k.batch_id}</Link></>}</dd></div>
          <div><dt>İlk okutma</dt><dd>{fmt(k.activated_at)}</dd></div>
        </dl>
        <div className="actions-row">
          {k.token_enc ? (
            <a className="button secondary" href={`/admin/pdf?ids=${k.id}`}>PDF indir</a>
          ) : (
            <span className="muted">Token saklanmamış (eski üretim), PDF alınamaz.</span>
          )}
          <form action={setKeychainStatus}>
            <input type="hidden" name="id" value={k.id} />
            <input type="hidden" name="status" value={k.status === "disabled" ? "active" : "disabled"} />
            <button className="secondary">{k.status === "disabled" ? "Etkinleştir" : "Devre dışı bırak"}</button>
          </form>
          <form action={deleteKeychain}>
            <input type="hidden" name="id" value={k.id} />
            <ConfirmButton message={`${k.label} ve tüm okutma geçmişi kalıcı olarak silinecek. Emin misin?`}>Kalıcı sil</ConfirmButton>
          </form>
        </div>
      </section>

      <section>
        <h2>Okutma geçmişi</h2>
        <ScansTable rows={rows} showKeychain={false} />
        <Pager path={`/admin/keychains/${k.id}`} params={{}} page={page} total={total} />
      </section>

      <section>
        <h2>Geri bildirimler</h2>
        {feedback.data!.length === 0 ? (
          <p className="muted">Yok.</p>
        ) : (
          <table>
            <tbody>
              {feedback.data!.map((f) => (
                <tr key={f.id}>
                  <td className="nowrap">{fmt(f.created_at)}</td>
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
