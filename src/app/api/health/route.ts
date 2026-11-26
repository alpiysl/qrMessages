import { db } from "@/lib/db";

// Daily ping target (Vercel Cron) that also keeps the free Supabase project from pausing.
export async function GET() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    return Response.json({ ok: false, reason: "missing_env" }, { status: 500 });
  }
  const { error } = await db().from("messages").select("id", { head: true, count: "exact" });
  if (error) {
    // Only the error code is exposed (e.g. 42P01 = table missing, PGRST301 = bad key).
    return Response.json({ ok: false, reason: "db_error", code: error.code ?? null }, { status: 500 });
  }
  return Response.json({ ok: true });
}
