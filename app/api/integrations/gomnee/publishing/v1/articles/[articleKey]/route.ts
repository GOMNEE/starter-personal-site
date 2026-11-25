import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { articles } from "@/db/schema";
import { apiError, HttpError, readJson } from "@/lib/http";
import { requirePublisher } from "@/lib/publishing/auth";
import { publicationObservation, publishArticle } from "@/lib/publishing/publish";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ articleKey: string }> };

/** Read one published Article back, exactly as stored. */
export async function GET(request: Request, context: Context) {
  try {
    requirePublisher(request);
    const articleKey = z.uuid().parse((await context.params).articleKey);
    const [article] = await getDb()
      .select()
      .from(articles)
      .where(and(eq(articles.gomneeArticleKey, articleKey), eq(articles.status, "published")));
    if (!article) throw new HttpError(404, "Publication not found.");
    return Response.json(publicationObservation(article), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}

/** Create or update one live Article. */
export async function PUT(request: Request, context: Context) {
  try {
    requirePublisher(request);
    const articleKey = z.uuid().parse((await context.params).articleKey);
    // Gomnee caps mapped commands, which carry the Article twice, at 250,000 bytes.
    const receipt = await publishArticle(articleKey, await readJson(request, 260_000));
    return Response.json(receipt, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
