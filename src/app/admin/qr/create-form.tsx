"use client";

import { useActionState } from "react";
import { createBatch, type CreateBatchState } from "../actions";

const MAX = 30;

export function CreateForm() {
  const [state, action, pending] = useActionState<CreateBatchState, FormData>(createBatch, { error: "" });
  return (
    <>
      <form action={action} className="qr-form">
        <label>
          Adet (1–{MAX})
          <input type="number" name="count" min={1} max={MAX} defaultValue={10} required />
        </label>
        <label>
          Önek
          <input type="text" name="prefix" defaultValue="KC" maxLength={10} pattern="[A-Za-z0-9]{1,10}" required />
        </label>
        <label>
          QR boyutu
          <select name="size" defaultValue="3">
            <option value="2">2 cm</option>
            <option value="3">3 cm</option>
            <option value="4">4 cm</option>
          </select>
        </label>
        <button disabled={pending}>{pending ? "Üretiliyor..." : "Üret"}</button>
      </form>
      {state.error && <p className="error">{state.error}</p>}
      {state.batchId && (
        <p className="success">
          {state.labels} üretildi.{" "}
          <a className="button" href={`/admin/pdf?batch=${state.batchId}`}>PDF indir</a>
        </p>
      )}
    </>
  );
}
