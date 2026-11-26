import type { Metadata } from "next";
import { isAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { addMessage, setMessageActive, updateMessage } from "../actions";
import { LoginForm } from "../login-form";
import { AdminShell, PAGE_SIZE, Pager, pageNumber, param } from "../ui";
import { ImportForm } from "./import-form";

export const instant = false;
export const metadata: Metadata = { title: "Mesajlar", robots: { index: false, follow: false } };

type MessageRow = { id: number; text: string; author: string | null; active: boolean; views: number; total: number };

export default async function MessagesPage({ searchParams }: PageProps<"/admin/messages">) {
  if (!(await isAdmin())) return <LoginForm />;
  const sp = await searchParams;
  const q = param(sp.q);
  const activeParam = param(sp.active);
  const active = activeParam === "true" || activeParam === "false" ? activeParam : undefined;
  const page = pageNumber(sp.page);

  const { data, error } = await db().rpc("admin_messages", {
    p_search: q ?? null,
    p_active: active ? active === "true" : null,
    p_limit: PAGE_SIZE,
    p_offset: (page - 1) * PAGE_SIZE,
  });
  if (error) throw error;
  const rows = data as MessageRow[];

  return (
    <AdminShell active="messages" title="Mesajlar">
      <section>
        <h2>Yeni mesaj</h2>
        <form action={addMessage} className="inline-form">
          <input type="text" name="text" placeholder="Mesaj" maxLength={500} required />
          <input type="text" name="author" placeholder="Yazar (opsiyonel)" maxLength={100} />
          <button>Ekle</button>
        </form>
        <ImportForm />
      </section>

      <section>
        <form className="filters">
          <input type="text" name="q" defaultValue={q} placeholder="Mesaj veya yazar ara" />
          <select name="active" defaultValue={active ?? ""}>
            <option value="">Tümü</option>
            <option value="true">Aktif</option>
            <option value="false">Pasif</option>
          </select>
          <button>Filtrele</button>
        </form>
        {rows.length === 0 ? (
          <p className="muted">Kayıt yok.</p>
        ) : (
          <table>
            <thead>
              <tr><th>#</th><th>Mesaj</th><th>Yazar</th><th>Gösterim</th><th>Durum</th></tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id} className={m.active ? undefined : "dim"}>
                  <td>{m.id}</td>
                  <td>
                    <details className="edit">
                      <summary>{m.text}</summary>
                      <form action={updateMessage} className="inline-form">
                        <input type="hidden" name="id" value={m.id} />
                        <input type="text" name="text" defaultValue={m.text} maxLength={500} required />
                        <input type="text" name="author" defaultValue={m.author ?? ""} placeholder="Yazar" maxLength={100} />
                        <button>Kaydet</button>
                      </form>
                    </details>
                  </td>
                  <td className="nowrap">{m.author ?? "—"}</td>
                  <td>{m.views}</td>
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
        )}
        <Pager path="/admin/messages" params={{ q, active }} page={page} total={rows[0]?.total ?? 0} />
      </section>
    </AdminShell>
  );
}
