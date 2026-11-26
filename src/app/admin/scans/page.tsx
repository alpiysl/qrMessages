import type { Metadata } from "next";
import { isAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { LoginForm } from "../login-form";
import { AdminShell, PAGE_SIZE, Pager, ScansTable, pageNumber, param, type ScanRow } from "../ui";

export const instant = false;
export const metadata: Metadata = { title: "Okutmalar", robots: { index: false, follow: false } };

export default async function ScansPage({ searchParams }: PageProps<"/admin/scans">) {
  if (!(await isAdmin())) return <LoginForm />;
  const sp = await searchParams;
  const q = param(sp.q);
  const page = pageNumber(sp.page);

  const { data, error } = await db().rpc("admin_scans", {
    p_search: q ?? null,
    p_limit: PAGE_SIZE,
    p_offset: (page - 1) * PAGE_SIZE,
  });
  if (error) throw error;
  const rows = data as ScanRow[];

  return (
    <AdminShell active="scans" title="Okutmalar" autoRefresh>
      <section>
        <form className="filters">
          <input type="text" name="q" defaultValue={q} placeholder="Etiket, mesaj veya yazar ara" />
          <button>Filtrele</button>
        </form>
        <ScansTable rows={rows} />
        <Pager path="/admin/scans" params={{ q }} page={page} total={rows[0]?.total ?? 0} />
      </section>
    </AdminShell>
  );
}
