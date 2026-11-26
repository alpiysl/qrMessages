import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";

const CM = 72 / 2.54;
const A4 = { w: 595.28, h: 841.89 };
const MARGIN = 1 * CM;
const PAD = 0.3 * CM;
const LABEL_H = 0.45 * CM;
const QUIET_MODULES = 2;

export type PdfItem = { label: string; url: string };

// A4 grid of vector QR codes, each with its label and a dashed cut border.
// sizeCm is the printed QR size including the quiet zone.
export async function renderQrPdf(items: PdfItem[], sizeCm: number, title?: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(title ?? "QR anahtarlıklar");
  const font = await doc.embedFont(StandardFonts.Helvetica);

  const qrPt = sizeCm * CM;
  const cellW = qrPt + PAD * 2;
  const cellH = qrPt + LABEL_H + PAD * 2;
  const cols = Math.max(1, Math.floor((A4.w - MARGIN * 2) / cellW));
  const rows = Math.max(1, Math.floor((A4.h - MARGIN * 2) / cellH));
  const perPage = cols * rows;
  const offsetX = (A4.w - cols * cellW) / 2;
  const fontSize = Math.min(9, Math.max(6, sizeCm * 2.5));
  const pages = Math.ceil(items.length / perPage);

  for (let p = 0; p < pages; p++) {
    const page = doc.addPage([A4.w, A4.h]);
    items.slice(p * perPage, (p + 1) * perPage).forEach((item, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = offsetX + col * cellW;
      const yTop = A4.h - MARGIN - row * cellH;

      page.drawRectangle({
        x, y: yTop - cellH, width: cellW, height: cellH,
        borderColor: rgb(0.75, 0.75, 0.75), borderWidth: 0.5, borderDashArray: [3, 3],
      });

      const qr = QRCode.create(item.url, { errorCorrectionLevel: "M" });
      const n = qr.modules.size;
      const mod = qrPt / (n + QUIET_MODULES * 2);
      const qx = x + PAD + QUIET_MODULES * mod;
      const qyTop = yTop - PAD - QUIET_MODULES * mod;
      for (let r = 0; r < n; r++) {
        // Merge horizontal runs of dark modules into one rectangle to keep the PDF small.
        let c = 0;
        while (c < n) {
          if (!qr.modules.get(r, c)) { c++; continue; }
          const start = c;
          while (c < n && qr.modules.get(r, c)) c++;
          page.drawRectangle({
            x: qx + start * mod, y: qyTop - (r + 1) * mod,
            width: (c - start) * mod + 0.01, height: mod + 0.01, color: rgb(0, 0, 0),
          });
        }
      }

      const textW = font.widthOfTextAtSize(item.label, fontSize);
      page.drawText(item.label, {
        x: x + (cellW - textW) / 2, y: yTop - PAD - qrPt - LABEL_H + 2, size: fontSize, font, color: rgb(0, 0, 0),
      });
    });
    page.drawText(`${p + 1} / ${pages}`, { x: A4.w - MARGIN - 30, y: MARGIN / 2, size: 7, font, color: rgb(0.5, 0.5, 0.5) });
  }

  return doc.save();
}
