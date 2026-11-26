import { db } from "@/lib/db";

// Daily ping target (Vercel Cron) that also keeps the free Supabase project from pausing.
export async function GET() {
  const { error } = await db().from("messages").select("id", { head: true, count: "exact" });
  if (error) return Response.json({ ok: false }, { status: 500 });
  return Response.json({ ok: true });
}
