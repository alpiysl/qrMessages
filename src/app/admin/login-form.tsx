"use client";

import { useActionState } from "react";
import { login } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, { error: "" });

  return (
    <main className="card">
      <h1>Yönetim girişi</h1>
      <form action={action} className="feedback" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <input type="password" name="password" placeholder="Şifre" autoComplete="current-password" required autoFocus />
        <button type="submit" disabled={pending}>{pending ? "Kontrol ediliyor..." : "Giriş"}</button>
        {state.error && <p className="error">{state.error}</p>}
      </form>
    </main>
  );
}
