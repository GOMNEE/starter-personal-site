import { createHash, randomBytes } from "node:crypto";
import { and, count, eq, gt, lte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { articlePreviews, articles } from "@/db/schema";
import { HttpError } from "@/lib/http";
import { absoluteUrl } from "@/lib/site";
import { articlePreviewRequestSchema, type ArticlePreviewReceipt } from "./preview-contract";
import { contentDigest, TEMPLATE } from "./publish";

/** Where a preview renders. Only Gomnee may frame it (see next.config.ts). */
export const PREVIEW_PATH = "/article-preview";
// Leaves transport headroom within the contract's 15-minute maximum.
export const ARTICLE_PREVIEW_LIFETIME_MS = 14 * 60 * 1000;
export const MAX_ACTIVE_ARTICLE_PREVIEWS = 100;
const tokenPattern = /^[a-zA-Z0-9_-]{43}$/;

function tokenHash(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Keeps one immutable snapshot to render, never an Article or a publication.
 * The link is a 32-byte random token; only its hash is stored, and it expires
 * after 14 minutes.
 */
export async function createArticlePreview(input: unknown): Promise<ArticlePreviewReceipt> {
  const request = articlePreviewRequestSchema.parse(input);
  if (request.template.id !== TEMPLATE.id || request.template.version !== TEMPLATE.version)
    throw new HttpError(409, "The website template changed. Refresh the destination before previewing.");
  if (contentDigest(request.article) !== request.contentDigest)
    throw new HttpError(400, "The preview digest does not match the article.");

  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ARTICLE_PREVIEW_LIFETIME_MS);
  await getDb().transaction(async (tx) => {
    // Serializes cleanup and capacity admission across every server instance.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended('article-preview-capacity', 0))`);
    await tx.delete(articlePreviews).where(lte(articlePreviews.expiresAt, now));
    const [active] = await tx.select({ count: count() }).from(articlePreviews);
    if (active.count >= MAX_ACTIVE_ARTICLE_PREVIEWS)
      throw new HttpError(429, "Too many private previews. Wait for an earlier preview to expire.");
    const [publication] = await tx
      .select({ publishedAt: articles.publishedAt, updatedAt: articles.updatedAt })
      .from(articles)
      .where(and(eq(articles.gomneeArticleKey, request.articleKey), eq(articles.status, "published")));
    await tx.insert(articlePreviews).values({
      tokenHash: tokenHash(token),
      articleKey: request.articleKey,
      sourceRevisionId: request.sourceRevisionId,
      snapshotKind: request.snapshotKind,
      contentDigest: request.contentDigest,
      template: request.template,
      article: request.article,
      publishedAt: publication?.publishedAt ?? null,
      publicationUpdatedAt: publication?.updatedAt ?? null,
      createdAt: now,
      expiresAt,
    });
  });
  return {
    schemaVersion: "gomnee_article_preview_receipt_v1",
    articleKey: request.articleKey,
    sourceRevisionId: request.sourceRevisionId,
    snapshotKind: request.snapshotKind,
    contentDigest: request.contentDigest,
    template: request.template,
    previewUrl: absoluteUrl(`${PREVIEW_PATH}/${token}`),
    expiresAt: expiresAt.toISOString(),
  };
}

/** Tokens are capability URLs: an unknown, expired or outdated one reads as not found. */
export async function getArticlePreview(token: string) {
  if (!tokenPattern.test(token)) return null;
  const [preview] = await getDb()
    .select()
    .from(articlePreviews)
    .where(and(eq(articlePreviews.tokenHash, tokenHash(token)), gt(articlePreviews.expiresAt, new Date())));
  if (!preview || preview.template.id !== TEMPLATE.id || preview.template.version !== TEMPLATE.version)
    return null;
  return preview;
}
