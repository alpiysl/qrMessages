import { isAdmin } from "@/lib/admin-auth";
import { baseUrlFromRequest } from "@/lib/base-url";
import { db } from "@/lib/db";
import { QR_SIZES_CM, keychainUrl } from "@/lib/keychain-factory";
import { renderQrPdf } from "@/lib/pdf";
import { decryptToken } from "@/lib/token-crypto";

// GET /admin/pdf?batch=12 | ?ids=1,2,3   [&size=2|3|4]
export async function GET(request: Request) {
  if (!(await isAdmin())) return new Response("Unauthorized", { status: 401 });

  const params = new URL(request.url).searchParams;
  const batchId = Number(params.get("batch"));
  const ids = (params.get("ids") ?? "").split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0);
  if (!batchId && !ids.length) return new Response("batch or ids required", { status: 400 });

  const client = db();
  let query = client.from("keychains").select("id, label, token_enc").order("label");
  query = batchId ? query.eq("batch_id", batchId) : query.in("id", ids.slice(0, 1000));
  const { data, error } = await query;
  if (error) return new Response(error.message, { status: 500 });

  let size = Number(params.get("size"));
  if (!QR_SIZES_CM.includes(size as (typeof QR_SIZES_CM)[number])) {
    size = 3;
    if (batchId) {
      const { data: b } = await client.from("batches").select("qr_size_cm").eq("id", batchId).maybeSingle();
      if (b) size = Number(b.qr_size_cm);
    }
  }

  const printable = data.filter((k) => k.token_enc);
  if (!printable.length) {
    return new Response("Seçilen QR'lar için saklanmış token yok (eski üretim). Yeniden üretin.", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const baseUrl = await baseUrlFromRequest(request);
  const items = printable.map((k) => ({ label: k.label, url: keychainUrl(baseUrl, decryptToken(k.token_enc!)) }));
  const name = batchId ? `qr-batch-${batchId}` : `qr-${items[0].label}${items.length > 1 ? `-${items.length}adet` : ""}`;
  const pdf = await renderQrPdf(items, size, name);

  return new Response(Buffer.from(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${name}.pdf"`,
      "cache-control": "no-store",
      "x-skipped": String(data.length - printable.length),
    },
  });
}
