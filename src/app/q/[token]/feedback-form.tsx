"use client";

import { useActionState, useEffect, useRef } from "react";
import { submitFeedback, type FeedbackState } from "./actions";

const initial: FeedbackState = { status: "idle", message: "" };

// Suggestion entry kept apart from the message: a trigger below the card opens a bottom sheet.
export function FeedbackForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(submitFeedback, initial);
  const dialog = useRef<HTMLDialogElement>(null);
  const done = state.status === "ok";

  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => dialog.current?.close(), 2500);
    return () => clearTimeout(t);
  }, [done]);

  return (
    <>
      {done ? (
        <p className="feedback-trigger muted">Önerin için teşekkürler</p>
      ) : (
        <button type="button" className="feedback-trigger" onClick={() => dialog.current?.showModal()}>
          Öneri gönder
        </button>
      )}
      <dialog
        ref={dialog}
        className="sheet"
        aria-labelledby="feedback-title"
        onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
      >
        <div className="sheet-body">
          <div className="sheet-head">
            <h2 id="feedback-title">{done ? "Teşekkürler" : "Bir önerin mi var?"}</h2>
            <button type="button" className="sheet-close" aria-label="Kapat" onClick={() => dialog.current?.close()}>
              ✕
            </button>
          </div>
          {done ? (
            <p className="feedback-done" aria-live="polite">{state.message}</p>
          ) : (
            <form action={action}>
              <input type="hidden" name="token" value={token} />
              <textarea name="message" maxLength={1000} required rows={4} placeholder="Önerini yaz..." />
              <button type="submit" disabled={pending}>
                {pending ? "Gönderiliyor..." : "Gönder"}
              </button>
              {state.status === "error" && <p className="error" aria-live="polite">{state.message}</p>}
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}
