"use client";

import type { ReactNode } from "react";

// Submit button that asks for confirmation first.
export function ConfirmButton(props: { message: string; children: ReactNode; className?: string; name?: string; value?: string }) {
  return (
    <button
      className={props.className ?? "danger"}
      name={props.name}
      value={props.value}
      onClick={(e) => {
        if (!confirm(props.message)) e.preventDefault();
      }}
    >
      {props.children}
    </button>
  );
}
