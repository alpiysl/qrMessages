"use client";

import { useActionState } from "react";
import { submitFeedback, type FeedbackState } from "./actions";

const initial: FeedbackState = { status: "idle", message: "" };

export function FeedbackForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(submitFeedback, initial);

  if (state.status === "ok") {
    return <p className="feedback-done">{state.message}</p>;
  }

  return (
    <details className="feedback">
      <summary>Bir önerin mi var?</summary>
      <form action={action}>
        <input type="hidden" name="token" value={token} />
        <textarea name="message" maxLength={1000} required rows={3} placeholder="Önerini yaz..." />
        <button type="submit" disabled={pending}>
          {pending ? "Gönderiliyor..." : "Gönder"}
        </button>
        {state.status === "error" && <p className="error" aria-live="polite">{state.message}</p>}
      </form>
    </details>
  );
}
