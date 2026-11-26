import type { Metadata } from "next";
import { isAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { LoginForm } from "../login-form";
import { AdminShell, PAGE_SIZE, Pager, STATUS_LABEL, pageNumber, param, type KeychainStatus } from "../ui";
import { KeychainTable, type KeychainRow } from "./keychain-table";

export const instant = false;
export const metadata: Metadata = { title: "Anahtarlıklar", robots: { index: false, follow: false } };

type BatchRow = { id: number; prefix: string; first_label: string | null; last_label: string | null };

export default async function KeychainsPage({ searchParams }: PageProps<"/admin/keychains">) {
  if (!(await isAdmin())) return <LoginForm />;
  const sp = await searchParams;
  const q = param(sp.q);
  const statusParam = param(sp.status);
  const status = statusParam && statusParam in STATUS_LABEL ? (statusParam as KeychainStatus) : undefined;
  const batchParam = param(sp.batch);
  const batch = batchParam && Number.isInteger(Number(batchParam)) ? batchParam : undefined;
  const page = pageNumber(sp.page);

  const client = db();
  const [list, batches] = await Promise.all([
    client.rpc("admin_keychains", {
      p_search: q ?? null,
      p_status: status ?? null,
      p_batch_id: batch ? Number(batch) : null,
      p_limit: PAGE_SIZE,
      p_offset: (page - 1) * PAGE_SIZE,
    }),
    client.rpc("admin_batches"),
  ]);
  if (list.error) throw list.error;
  if (batches.error) throw batches.error;
  const rows = list.data as KeychainRow[];

  return (
    <AdminShell active="keychains" title="Anahtarlıklar">
      <section>
        <form className="filters">
          <input type="text" name="q" defaultValue={q} placeholder="Etiket ara (ör. KC-0001)" />
          <select name="status" defaultValue={status ?? ""}>
            <option value="">Tüm durumlar</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select name="batch" defaultValue={batch ?? ""}>
            <option value="">Tüm üretimler</option>
            {(batches.data as BatchRow[]).map((b) => (
              <option key={b.id} value={b.id}>
                #{b.id} {b.first_label ? `${b.first_label} – ${b.last_label}` : `${b.prefix} (boş)`}
              </option>
            ))}
          </select>
          <button>Filtrele</button>
        </form>
        <KeychainTable rows={rows} />
        <Pager path="/admin/keychains" params={{ q, status, batch }} page={page} total={rows[0]?.total ?? 0} />
      </section>
    </AdminShell>
  );
}
