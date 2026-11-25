import { apiError, readJson } from "@/lib/http";
import { requirePublisher } from "@/lib/publishing/auth";
import { createArticlePreview } from "@/lib/publishing/preview";

export const dynamic = "force-dynamic";

/** A private, expiring snapshot Gomnee shows in its review screen. It publishes nothing. */
export async function POST(request: Request) {
  try {
    requirePublisher(request);
    const receipt = await createArticlePreview(await readJson(request, 262_144));
    return Response.json(receipt, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const response = apiError(error);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
}
