import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { apiError } from "@/lib/http";
import { requirePublisher } from "@/lib/publishing/auth";
import { publishingCapabilities } from "@/lib/publishing/publish";

// What the site can do, after a database round trip: Gomnee checks this before
// it connects, and again before every delivery.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    requirePublisher(request);
    await getDb().execute(sql`select 1`);
    return Response.json(publishingCapabilities(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
