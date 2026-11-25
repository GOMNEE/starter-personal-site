CREATE TYPE "public"."article_status" AS ENUM('published', 'archived');--> statement-breakpoint
CREATE TABLE "article_previews" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"article_key" uuid NOT NULL,
	"source_revision_id" uuid NOT NULL,
	"snapshot_kind" text NOT NULL,
	"content_digest" text NOT NULL,
	"template" jsonb NOT NULL,
	"article" jsonb NOT NULL,
	"published_at" timestamp with time zone,
	"publication_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "article_previews_token_hash" CHECK ("article_previews"."token_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "article_previews_digest" CHECK ("article_previews"."content_digest" ~ '^sha256:[a-f0-9]{64}$'),
	CONSTRAINT "article_previews_kind" CHECK ("article_previews"."snapshot_kind" in ('saved', 'unsaved')),
	CONSTRAINT "article_previews_lifetime" CHECK ("article_previews"."expires_at" > "article_previews"."created_at" and "article_previews"."expires_at" <= "article_previews"."created_at" + interval '15 minutes')
);
--> statement-breakpoint
CREATE TABLE "articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gomnee_article_key" uuid NOT NULL,
	"slug" text NOT NULL,
	"payload" jsonb NOT NULL,
	"mapped_content" jsonb,
	"status" "article_status" DEFAULT 'published' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"last_article_revision_id" uuid,
	"last_command_id" uuid,
	"published_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "articles_gomnee_article_key_unique" UNIQUE("gomnee_article_key"),
	CONSTRAINT "articles_slug_unique" UNIQUE("slug"),
	CONSTRAINT "articles_slug_matches_payload" CHECK ("articles"."slug" = "articles"."payload"->>'slug'),
	CONSTRAINT "articles_positive_version" CHECK ("articles"."version" > 0),
	CONSTRAINT "articles_mapped_content_format" CHECK ("articles"."mapped_content" IS NULL OR "articles"."payload"->>'contentFormat' = 'gomnee_article_v2')
);
--> statement-breakpoint
CREATE TABLE "publication_commands" (
	"command_id" uuid PRIMARY KEY NOT NULL,
	"article_id" uuid NOT NULL,
	"request_digest" text NOT NULL,
	"receipt" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "publication_commands" ADD CONSTRAINT "publication_commands_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "article_previews_expiry_idx" ON "article_previews" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "articles_published_idx" ON "articles" USING btree ("status","published_at");