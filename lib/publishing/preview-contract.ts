import { z } from "zod";
import { articlePayloadSchema } from "./contract";

export const articlePreviewTemplateSchema = z.strictObject({
  id: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/),
  version: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/),
});

/** A private rendering request. It grants no approval and publishes nothing. */
export const articlePreviewRequestSchema = z.strictObject({
  schemaVersion: z.literal("gomnee_article_preview_request_v1"),
  articleKey: z.uuid(),
  sourceRevisionId: z.uuid(),
  snapshotKind: z.enum(["saved", "unsaved"]),
  contentDigest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  template: articlePreviewTemplateSchema,
  article: articlePayloadSchema,
});

export type ArticlePreviewRequest = z.infer<typeof articlePreviewRequestSchema>;
export type ArticlePreviewTemplate = z.infer<typeof articlePreviewTemplateSchema>;

export type ArticlePreviewReceipt = Omit<ArticlePreviewRequest, "schemaVersion" | "article"> & {
  schemaVersion: "gomnee_article_preview_receipt_v1";
  previewUrl: string;
  expiresAt: string;
};
