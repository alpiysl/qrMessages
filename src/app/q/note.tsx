import type { ReactNode } from "react";
import { caveat, literata } from "./fonts";

// Paper note shell shared by the message, empty and preview states.
export function NoteShell(props: { above?: ReactNode; children: ReactNode; below?: ReactNode }) {
  return (
    <div className={`note-page ${literata.variable} ${caveat.variable}`}>
      {props.above}
      <main className="note">
        <span className="note-tape" aria-hidden />
        {props.children}
      </main>
      {props.below}
    </div>
  );
}
