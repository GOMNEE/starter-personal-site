import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { articles, publicationCommands, type ArticleRow } from "@/db/schema";
import { HttpError } from "@/lib/http";
import { SITE, absoluteUrl } from "@/lib/site";
import {
  publishRequestSchema,
  type ArticlePayload,
  type MappedContent,
  type PublishRequest,
  type TypedArticlePayload,
} from "./contract";

/**
 * The site's side of Gomnee's Custom Website protocol: what it declares it can
 * do, and the one write it accepts. Gomnee checks the declaration, sends one
 * exact approved revision, and reads the result back.
 */
export const ADAPTER_KEY = "gomnee.custom_website_articles";
/** The article page's identity. Bump the version when the page changes what it shows. */
export const TEMPLATE = { id: "personal-site-blog", version: "1" };
// One complete-Article field: the page renders typed modules itself, so no
// separate CMS fields or author/term catalogues are declared.
export const DESTINATION_SHAPE = {
  schemaVersion: "gomnee_publication_destination_v1",
  version: "1",
  fields: [
    {
      key: "content",
      label: "Complete Article",
      type: "article",
      required: true,
      sourceHint: "article",
    },
  ],
};

export function articlePath(slug: string) {
  return `/blog/${slug}`;
}

export function publishingCapabilities() {
  return {
    schemaVersion: "gomnee_publishing_capabilities_v2",
    adapterKey: ADAPTER_KEY,
    adapterVersion: "1",
    siteOrigin: new URL(SITE.url).origin,
    status: "ready",
    capabilities: ["publish_live", "update_live", "read_publication"],
    limitations: [
      "no_remote_drafts",
      "no_remote_delete",
      "no_private_list",
      "slug_immutable_after_publish",
    ],
    contentFormats: ["markdown", "gomnee_article_v1", "gomnee_article_v2"],
    template: TEMPLATE,
    destinationShape: DESTINATION_SHAPE,
    coverPlacement: "listing_card",
  };
}

// Sorted keys and HTML-sensitive escaping, exactly as Gomnee hashes its wire documents.
export function canonicalJson(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string")
    return JSON.stringify(value)
      .replaceAll("<", "\\u003c")
      .replaceAll(">", "\\u003e")
      .replaceAll("&", "\\u0026");
  if ((typeof value === "number" && Number.isFinite(value)) || typeof value === "boolean")
    return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object" && value)
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${canonicalJson(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`)
      .join(",")}}`;
  throw new HttpError(400, "Unsupported JSON value.");
}

export function contentDigest(value: unknown) {
  return `sha256:${createHash("sha256").update(canonicalJson(value), "utf8").digest("hex")}`;
}

// A mapped publication's digest covers the canonical Article and its mapped copy.
function publicationDigest(article: ArticlePayload, mappedContent: MappedContent | null | undefined) {
  return contentDigest(mappedContent ? { article, mappedContent } : article);
}

function publicationFields(article: ArticleRow) {
  return {
    adapterKey: ADAPTER_KEY,
    adapterVersion: "1",
    articleKey: article.gomneeArticleKey,
    remoteContentId: article.id,
    remoteVersion: article.version,
    status: "published",
    slug: article.slug,
    publicUrl: absoluteUrl(articlePath(article.slug)),
    contentDigest: publicationDigest(article.payload, article.mappedContent),
    providerTimestamp: article.updatedAt.toISOString(),
    publishedAt: article.publishedAt.toISOString(),
    updatedAt: article.updatedAt.toISOString(),
    template: TEMPLATE,
  };
}

/** What Gomnee reads back: the stored Article exactly as it was sent. */
export function publicationObservation(article: ArticleRow) {
  return {
    schemaVersion: article.mappedContent
      ? "gomnee_live_article_observation_v2"
      : "gomnee_live_article_observation_v1",
    ...publicationFields(article),
    title: article.payload.title,
    summary: article.payload.summary,
    lastArticleRevisionId: article.lastArticleRevisionId,
    lastCommandId: article.lastCommandId,
    article: article.payload,
    ...(article.mappedContent && { mappedContent: article.mappedContent }),
  };
}

/**
 * Creates or updates one live Article. A repeated command returns its original
 * receipt; a stale version, a changed slug or a reused command with other
 * content is refused with 409 and changes nothing.
 */
export async function publishArticle(articleKey: string, input: unknown) {
  const request = publishRequestSchema.parse(input);
  const mappedContent = "mappedContent" in request ? request.mappedContent : null;
  if (mappedContent && canonicalJson(mappedContent.fields[0].value) !== canonicalJson(request.article))
    throw new HttpError(400, "The mapped Article must equal the canonical Article.");
  if (request.contentDigest !== publicationDigest(request.article, mappedContent))
    throw new HttpError(400, "The content digest does not match the article.");
  const requestDigest = contentDigest({ articleKey, ...request });
  return getDb().transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${"publication-command:" + request.commandId}, 0))`,
    );
    const [previous] = await tx
      .select()
      .from(publicationCommands)
      .where(eq(publicationCommands.commandId, request.commandId));
    if (previous) {
      if (previous.requestDigest !== requestDigest)
        throw new HttpError(409, "This command ID has already been used with different content.");
      return { ...previous.receipt, operation: "reconciled" };
    }
    // Checked after exact replay, so a later declaration change cannot invalidate an accepted command.
    if (mappedContent && mappedContent.mapping.destinationShapeDigest !== contentDigest(DESTINATION_SHAPE))
      throw new HttpError(409, "The destination fields changed. Refresh the publication mapping.");
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${"publication-article:" + articleKey}, 0))`);
    const [existing] = await tx
      .select()
      .from(articles)
      .where(eq(articles.gomneeArticleKey, articleKey))
      .for("update");
    if (
      existing &&
      (existing.status !== "published" ||
        existing.version !== request.expectedRemoteVersion ||
        existing.slug !== request.article.slug)
    )
      throw new HttpError(409, "The article version, slug or publication status has changed.");
    if (!existing && request.expectedRemoteVersion !== null)
      throw new HttpError(409, "The article has not been published yet.");
    if (!existing)
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${"publication-slug:" + request.article.slug}, 0))`,
      );
    const now = new Date();
    let saved: ArticleRow;
    if (existing)
      [saved] = await tx
        .update(articles)
        .set({
          payload: request.article,
          mappedContent,
          version: existing.version + 1,
          updatedAt: now,
          lastArticleRevisionId: request.articleRevisionId,
          lastCommandId: request.commandId,
        })
        .where(eq(articles.id, existing.id))
        .returning();
    else {
      const [slugOwner] = await tx
        .select({ id: articles.id })
        .from(articles)
        .where(eq(articles.slug, request.article.slug));
      if (slugOwner) throw new HttpError(409, "The slug belongs to another article.");
      [saved] = await tx
        .insert(articles)
        .values({
          gomneeArticleKey: articleKey,
          slug: request.article.slug,
          payload: request.article,
          mappedContent,
          status: "published",
          publishedAt: now,
          updatedAt: now,
          lastArticleRevisionId: request.articleRevisionId,
          lastCommandId: request.commandId,
        })
        .returning();
    }
    const receipt = {
      schemaVersion: mappedContent ? "gomnee_live_article_receipt_v2" : "gomnee_live_article_receipt_v1",
      ...publicationFields(saved),
      operation: existing ? "updated" : "created",
      commandId: request.commandId,
      articleRevisionId: request.articleRevisionId,
      requestDigest,
      providerCorrelationId: request.commandId,
      ...(mappedContent && { mapping: mappedContent.mapping }),
    };
    await tx.insert(publicationCommands).values({
      commandId: request.commandId,
      articleId: saved.id,
      requestDigest,
      receipt,
    });
    return receipt;
  });
}

type Ids = {
  commandId: string;
  articleRevisionId: string;
  expectedRemoteVersion: number | null;
};
/** Builds a request the way Gomnee does. Tests and `pnpm check` use it. */
export function makePublishRequest(article: ArticlePayload, ids: Ids): PublishRequest;
export function makePublishRequest(
  article: TypedArticlePayload,
  ids: Ids,
  mapping: Omit<MappedContent["mapping"], "destinationShapeDigest">,
): Extract<PublishRequest, { schemaVersion: "gomnee_live_article_publish_v3" }>;
export function makePublishRequest(
  article: ArticlePayload,
  ids: Ids,
  mapping?: Omit<MappedContent["mapping"], "destinationShapeDigest">,
): PublishRequest {
  const mappedContent =
    mapping && article.contentFormat === "gomnee_article_v2"
      ? {
          mapping: { ...mapping, destinationShapeDigest: contentDigest(DESTINATION_SHAPE) },
          fields: [{ key: "content", type: "article", value: article }],
        }
      : undefined;
  return publishRequestSchema.parse({
    ...ids,
    schemaVersion: mappedContent
      ? "gomnee_live_article_publish_v3"
      : article.contentFormat === "markdown"
        ? "gomnee_live_article_publish_v1"
        : "gomnee_live_article_publish_v2",
    article,
    ...(mappedContent && { mappedContent }),
    contentDigest: publicationDigest(article, mappedContent as MappedContent | undefined),
  });
}
