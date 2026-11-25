import { and, desc, eq } from "drizzle-orm";
import { databaseConfigured, getDb } from "@/db";
import { articles, type ArticleRow } from "@/db/schema";
import { articleCategories } from "@/lib/article-view";
import type { ArticlePayload } from "@/lib/publishing/contract";

/**
 * Articles are the ones Gomnee published to this site, stored as Gomnee sent
 * them (lib/publishing). This is the only module public pages read them
 * through. Without DATABASE_URL the site has no Articles yet, and every page
 * still answers.
 */
export type PublishedArticle = Readonly<{
  slug: string;
  payload: ArticlePayload;
  /** ISO date-times, set by this site when Gomnee first published and last updated it. */
  publishedAt: string;
  updatedAt: string;
}>;

/** What lists show: the index, the home page, related Articles, the sitemap. */
export type ArticleSummary = Readonly<{
  slug: string;
  title: string;
  summary: string;
  publishedAt: string;
  updatedAt: string;
  categories: readonly string[];
  /** Listing-card artwork only, never a body image or share image. */
  cover: Readonly<{ url: string; alt: string; width: number; height: number }> | null;
}>;

function published(row: ArticleRow): PublishedArticle {
  return {
    slug: row.slug,
    payload: row.payload,
    publishedAt: row.publishedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function summaryOf(article: PublishedArticle): ArticleSummary {
  const { payload } = article;
  const cover = payload.contentFormat === "gomnee_article_v2" ? payload.cover : undefined;
  return {
    slug: article.slug,
    title: payload.title,
    summary: payload.summary,
    publishedAt: article.publishedAt,
    updatedAt: article.updatedAt,
    categories: articleCategories(payload),
    cover: cover ? { url: cover.url, alt: cover.alt, width: cover.width, height: cover.height } : null,
  };
}

/** Every published Article, newest first. */
export async function listArticles(): Promise<ArticleSummary[]> {
  if (!databaseConfigured()) return [];
  const rows = await getDb()
    .select()
    .from(articles)
    .where(eq(articles.status, "published"))
    .orderBy(desc(articles.publishedAt));
  return rows.map((row) => summaryOf(published(row)));
}

export async function getArticle(slug: string): Promise<PublishedArticle | null> {
  if (!databaseConfigured()) return null;
  const [row] = await getDb()
    .select()
    .from(articles)
    .where(and(eq(articles.slug, slug), eq(articles.status, "published")));
  return row ? published(row) : null;
}

/** Up to three other Articles: the same category first, then the newest. */
export async function relatedArticles(
  article: Pick<PublishedArticle, "slug" | "payload">,
  limit = 3,
): Promise<ArticleSummary[]> {
  const own = new Set(articleCategories(article.payload).map((category) => category.toLowerCase()));
  const others = (await listArticles()).filter((other) => other.slug !== article.slug);
  const shares = (other: ArticleSummary) => other.categories.some((category) => own.has(category.toLowerCase()));
  return [...others.filter(shares), ...others.filter((other) => !shares(other))].slice(0, limit);
}
