import { db } from "@/lib/db";

// Daily ping target (Vercel Cron) that also keeps the free Supabase project from pausing.
export async function GET() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    return Response.json({ ok: false, reason: "missing_env" }, { status: 500 });
  }
  const { error, status } = await db().from("messages").select("id").limit(1);
  if (error) {
    // No secrets here: e.g. 42P01/PGRST205 = table missing, 401 = bad key, 404 = wrong URL.
    return Response.json(
      { ok: false, reason: "db_error", status, code: error.code ?? null, message: error.message },
      { status: 500 },
    );
  }
  return Response.json({ ok: true });
}
