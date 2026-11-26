// Minimal RFC 4180 CSV parser for message imports: columns text[,author]. Header row optional.

function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const s = input.replace(/^\uFEFF/, "");

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"' && s[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && field === "") quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

export function parseMessagesCsv(input: string): { rows: { text: string; author: string | null }[]; invalid: number } {
  const all = parseCsv(input).filter((r) => r.some((c) => c.trim()));
  if (all.length && ["text", "mesaj", "metin"].includes(all[0][0]?.trim().toLowerCase())) all.shift();

  const rows: { text: string; author: string | null }[] = [];
  let invalid = 0;
  for (const r of all.slice(0, 2000)) {
    const text = (r[0] ?? "").trim();
    const author = (r[1] ?? "").trim().slice(0, 100) || null;
    if (!text || text.length > 500) invalid++;
    else rows.push({ text, author });
  }
  return { rows, invalid: invalid + Math.max(0, all.length - 2000) };
}
