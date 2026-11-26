"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

function Pending() {
  const { pending } = useLinkStatus();
  return (
    <span aria-hidden className={`link-pending${pending ? " on" : ""}`}>
      {pending && <span className="spinner" />}
    </span>
  );
}

// Link with a fixed-size spinner slot shown while navigation is pending.
export function NavLink(props: { href: string; className?: string; children: ReactNode }) {
  return (
    <Link href={props.href} className={props.className}>
      {props.children}
      <Pending />
    </Link>
  );
}

export const NAV = [
  { href: "/admin", label: "Özet" },
  { href: "/admin/scans", label: "Okutmalar" },
  { href: "/admin/keychains", label: "Anahtarlıklar" },
  { href: "/admin/messages", label: "Mesajlar" },
  { href: "/admin/qr", label: "QR Üret" },
] as const;

export function AdminNav() {
  const path = usePathname();
  return (
    <nav className="admin-nav">
      {NAV.map((n) => {
        const active = n.href === "/admin" ? path === "/admin" : path.startsWith(n.href);
        return (
          <NavLink key={n.href} href={n.href} className={active ? "active" : undefined}>
            {n.label}
          </NavLink>
        );
      })}
    </nav>
  );
}
