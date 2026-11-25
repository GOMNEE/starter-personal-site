import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type { ArticlePayload, MappedContent } from "@/lib/publishing/contract";
import type { ArticlePreviewTemplate } from "@/lib/publishing/preview-contract";

/**
 * Every Article on the site is one Gomnee published here. "archived" takes one
 * off the site without deleting it; Gomnee never deletes or unpublishes.
 */
export const articleStatus = pgEnum("article_status", ["published", "archived"]);

export const articles = pgTable(
  "articles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gomneeArticleKey: uuid("gomnee_article_key").notNull().unique(),
    slug: text("slug").notNull().unique(),
    payload: jsonb("payload").$type<ArticlePayload>().notNull(),
    // Present only for gomnee_live_article_publish_v3; its digest covers both documents.
    mappedContent: jsonb("mapped_content").$type<MappedContent>(),
    status: articleStatus("status").notNull().default("published"),
    version: integer("version").notNull().default(1),
    lastArticleRevisionId: uuid("last_article_revision_id"),
    lastCommandId: uuid("last_command_id"),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("articles_published_idx").on(table.status, table.publishedAt),
    check("articles_slug_matches_payload", sql`${table.slug} = ${table.payload}->>'slug'`),
    check("articles_positive_version", sql`${table.version} > 0`),
    check(
      "articles_mapped_content_format",
      sql`${table.mappedContent} IS NULL OR ${table.payload}->>'contentFormat' = 'gomnee_article_v2'`,
    ),
  ],
);
export type ArticleRow = typeof articles.$inferSelect;

/** One durable receipt per command, so an exact retry returns the same answer. */
export const publicationCommands = pgTable("publication_commands", {
  commandId: uuid("command_id").primaryKey(),
  articleId: uuid("article_id")
    .notNull()
    .references(() => articles.id),
  requestDigest: text("request_digest").notNull(),
  receipt: jsonb("receipt").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Expiring private render snapshots. Public pages never read them. */
export const articlePreviews = pgTable(
  "article_previews",
  {
    tokenHash: text("token_hash").primaryKey(),
    articleKey: uuid("article_key").notNull(),
    sourceRevisionId: uuid("source_revision_id").notNull(),
    snapshotKind: text("snapshot_kind").$type<"saved" | "unsaved">().notNull(),
    contentDigest: text("content_digest").notNull(),
    template: jsonb("template").$type<ArticlePreviewTemplate>().notNull(),
    article: jsonb("article").$type<ArticlePayload>().notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    publicationUpdatedAt: timestamp("publication_updated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("article_previews_expiry_idx").on(table.expiresAt),
    check("article_previews_token_hash", sql`${table.tokenHash} ~ '^[a-f0-9]{64}$'`),
    check("article_previews_digest", sql`${table.contentDigest} ~ '^sha256:[a-f0-9]{64}$'`),
    check("article_previews_kind", sql`${table.snapshotKind} in ('saved', 'unsaved')`),
    check(
      "article_previews_lifetime",
      sql`${table.expiresAt} > ${table.createdAt} and ${table.expiresAt} <= ${table.createdAt} + interval '15 minutes'`,
    ),
  ],
);
export type ArticlePreviewRow = typeof articlePreviews.$inferSelect;
