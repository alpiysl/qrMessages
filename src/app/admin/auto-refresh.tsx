"use client";

import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";

const INTERVAL_MS = 15_000;

// Re-fetches the server-rendered admin data periodically, on tab focus and on demand.
export function AutoRefresh() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") startTransition(() => router.refresh());
    };
    const id = setInterval(refresh, INTERVAL_MS);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("pageshow", refresh);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("pageshow", refresh);
    };
  }, [router]);

  return (
    <button
      type="button"
      className="secondary"
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
    >
      {pending ? "Yenileniyor…" : "Yenile"}
    </button>
  );
}
