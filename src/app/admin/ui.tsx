import Link from "next/link";
import type { ReactNode } from "react";
import { logout } from "./actions";
import { AutoRefresh } from "./auto-refresh";

export const PAGE_SIZE = 50;

const NAV = [
  { href: "/admin", key: "overview", label: "Özet" },
  { href: "/admin/scans", key: "scans", label: "Okutmalar" },
  { href: "/admin/keychains", key: "keychains", label: "Anahtarlıklar" },
  { href: "/admin/messages", key: "messages", label: "Mesajlar" },
  { href: "/admin/qr", key: "qr", label: "QR Üret" },
] as const;

export type NavKey = (typeof NAV)[number]["key"];

export const STATUS_LABEL = { generated: "Üretildi", active: "Aktif", disabled: "Devre dışı" } as const;
export type KeychainStatus = keyof typeof STATUS_LABEL;

export const fmt = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" }) : "—";

// Admin page frame: top navigation, optional auto refresh. Pages check isAdmin() themselves before querying.
export function AdminShell(props: { active: NavKey; title: string; autoRefresh?: boolean; children: ReactNode }) {
  return (
    <div className="admin">
      <header>
        <nav className="admin-nav">
          {NAV.map((n) => (
            <Link key={n.key} href={n.href} className={n.key === props.active ? "active" : undefined}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="header-actions">
          {props.autoRefresh && <AutoRefresh />}
          <form action={logout}>
            <button className="secondary">Çıkış</button>
          </form>
        </div>
      </header>
      <h1>{props.title}</h1>
      {props.children}
    </div>
  );
}

export function Pager(props: { path: string; params: Record<string, string | undefined>; page: number; total: number }) {
  const pages = Math.max(1, Math.ceil(props.total / PAGE_SIZE));
  if (pages <= 1) return <p className="muted pager">{props.total} kayıt</p>;
  const href = (page: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(props.params)) if (v) sp.set(k, v);
    if (page > 1) sp.set("page", String(page));
    const q = sp.toString();
    return q ? `${props.path}?${q}` : props.path;
  };
  return (
    <div className="pager">
      {props.page > 1 ? <Link href={href(props.page - 1)}>← Önceki</Link> : <span className="muted">← Önceki</span>}
      <span className="muted">
        Sayfa {props.page} / {pages} · {props.total} kayıt
      </span>
      {props.page < pages ? <Link href={href(props.page + 1)}>Sonraki →</Link> : <span className="muted">Sonraki →</span>}
    </div>
  );
}

export function pageNumber(raw: string | string[] | undefined): number {
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

export function param(raw: string | string[] | undefined): string | undefined {
  const v = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  return v ? v.slice(0, 200) : undefined;
}

export type ScanRow = {
  id: number;
  shown_at: string;
  round: number;
  keychain_id: number;
  label: string;
  message_id: number;
  message_text: string;
  author: string | null;
  total: number;
};

export function ScansTable({ rows, showKeychain = true }: { rows: ScanRow[]; showKeychain?: boolean }) {
  if (!rows.length) return <p className="muted">Henüz okutma yok.</p>;
  return (
    <table>
      <thead>
        <tr>
          <th>Tarih</th>
          {showKeychain && <th>Anahtarlık</th>}
          <th>Gösterilen mesaj</th>
          <th>Yazar</th>
          <th>Tur</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((s) => (
          <tr key={s.id}>
            <td className="nowrap">{fmt(s.shown_at)}</td>
            {showKeychain && (
              <td className="nowrap">
                <Link href={`/admin/keychains/${s.keychain_id}`}>{s.label}</Link>
              </td>
            )}
            <td>{s.message_text}</td>
            <td className="nowrap">{s.author ?? "—"}</td>
            <td>{s.round}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
