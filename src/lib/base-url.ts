import "server-only";
import { headers } from "next/headers";

// Base URL printed into QR codes: PUBLIC_BASE_URL, else the current request's origin.
export async function baseUrlFromRequest(request?: Request): Promise<string> {
  const configured = process.env.PUBLIC_BASE_URL?.replace(/\/+$/, "");
  if (configured) return configured;
  if (request) return new URL(request.url).origin;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
