"use client";

import Link from "next/link";
import { useState } from "react";
import { bulkKeychains } from "../actions";

export type KeychainRow = {
  id: number;
  label: string;
  status: "generated" | "active" | "disabled";
  batch_id: number | null;
  current_round: number;
  has_token: boolean;
  created_at: string;
  scans: number;
  last_scan: string | null;
  last_message: string | null;
  total: number;
};

const STATUS = { generated: "Üretildi", active: "Aktif", disabled: "Devre dışı" } as const;
const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" }) : "—";

// Keychain list with checkbox selection and bulk actions (status, delete, PDF).
export function KeychainTable({ rows }: { rows: KeychainRow[] }) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [size, setSize] = useState("3");
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const printable = rows.filter((r) => selected.has(r.id) && r.has_token).map((r) => r.id);

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (!rows.length) return <p className="muted">Kayıt yok.</p>;

  return (
    <form action={async (fd) => { await bulkKeychains(fd); setSelected(new Set()); }}>
      {[...selected].map((id) => <input key={id} type="hidden" name="ids" value={id} />)}
      <div className="bulk-bar">
        <span className="muted">{selected.size} seçili</span>
        <button className="secondary" name="op" value="disable" disabled={!selected.size}>Devre dışı bırak</button>
        <button className="secondary" name="op" value="enable" disabled={!selected.size}>Etkinleştir</button>
        <button
          className="danger"
          name="op"
          value="delete"
          disabled={!selected.size}
          onClick={(e) => {
            if (!confirm(`${selected.size} anahtarlık ve okutma geçmişleri kalıcı olarak silinecek. Emin misin?`)) e.preventDefault();
          }}
        >
          Kalıcı sil
        </button>
        <span className="spacer" />
        <select value={size} onChange={(e) => setSize(e.target.value)} aria-label="QR boyutu">
          <option value="2">2 cm</option>
          <option value="3">3 cm</option>
          <option value="4">4 cm</option>
        </select>
        <a
          className={`button secondary${printable.length ? "" : " disabled"}`}
          href={printable.length ? `/admin/pdf?ids=${printable.join(",")}&size=${size}` : undefined}
        >
          PDF ({printable.length})
        </a>
      </div>
      <table>
        <thead>
          <tr>
            <th>
              <input
                type="checkbox"
                aria-label="Tümünü seç"
                checked={allSelected}
                onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))}
              />
            </th>
            <th>Etiket</th>
            <th>Durum</th>
            <th>Okutma</th>
            <th>Tur</th>
            <th>Son okutma</th>
            <th>Son gösterilen mesaj</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((k) => (
            <tr key={k.id} className={k.status === "disabled" ? "dim" : undefined}>
              <td>
                <input type="checkbox" aria-label={k.label} checked={selected.has(k.id)} onChange={() => toggle(k.id)} />
              </td>
              <td className="nowrap">
                <Link href={`/admin/keychains/${k.id}`}>{k.label}</Link>
                {!k.has_token && <span className="badge" title="Token saklanmamış, PDF alınamaz">eski</span>}
              </td>
              <td className="nowrap">{STATUS[k.status]}</td>
              <td>{k.scans}</td>
              <td>{k.current_round}</td>
              <td className="nowrap">{fmt(k.last_scan)}</td>
              <td className="truncate" title={k.last_message ?? undefined}>{k.last_message ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </form>
  );
}
