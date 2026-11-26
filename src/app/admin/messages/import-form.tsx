"use client";

import { useActionState } from "react";
import { importMessages } from "../actions";

const SAMPLE = 'text,author\n"Hayatta en hakiki mürşit ilimdir.",Mustafa Kemal Atatürk\n"Virgül, içeren mesaj tırnak içinde olmalı.",\n';

export function ImportForm() {
  const [state, action, pending] = useActionState(importMessages, { result: "" });
  return (
    <details className="import">
      <summary>CSV ile toplu yükle</summary>
      <p className="muted">
        Sütunlar: <code>text,author</code> (başlık satırı opsiyonel, UTF-8). Virgül içeren mesajları çift tırnak içine al. Aynı metin tekrar eklenmez.{" "}
        <a href={`data:text/csv;charset=utf-8,${encodeURIComponent(SAMPLE)}`} download="mesajlar-ornek.csv">Örnek dosya</a>
      </p>
      <form action={action} className="inline-form">
        <input type="file" name="file" accept=".csv,text/csv" required />
        <button disabled={pending}>{pending ? "Yükleniyor..." : "Yükle"}</button>
      </form>
      {state.result && <p className="muted">{state.result}</p>}
    </details>
  );
}
