"use client";

import { useSyncExternalStore } from "react";

function greetingFor(hour: number) {
  if (hour >= 5 && hour < 11) return "Günaydın";
  if (hour >= 11 && hour < 18) return "İyi günler";
  if (hour >= 18 && hour < 23) return "İyi akşamlar";
  return "İyi geceler";
}

const subscribe = () => () => {};

// Uses the phone's local hour; renders an empty fixed-height slot on the server to avoid hydration mismatch.
export function Greeting() {
  const text = useSyncExternalStore(subscribe, () => greetingFor(new Date().getHours()), () => "");
  return <p className="note-greeting" aria-hidden={!text}>{text}</p>;
}
