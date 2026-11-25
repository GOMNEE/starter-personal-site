import { z } from "zod";

/**
 * Gomnee's public Article wire format and live publication requests, as the
 * Custom Website protocol defines them: Markdown (v1 requests), the rich
 * gomnee_article_v1 document (v2 requests) and the typed gomnee_article_v2
 * document, delivered plain or mapped (v3 requests). The schemas are strict:
 * an unknown field is refused, never stored.
 *
 * Ported from TrovaSEO's destination, which was qualified against Gomnee's own
 * validators. Change it only with Gomnee's contract.
 */
export const slugSchema = z
  .string()
  .min(1)
  .max(180)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const text = (max: number) => z.string().trim().min(1).max(max);
const key = z.string().regex(/^[a-z][a-z0-9_-]{0,79}$/);
export const publicUrlSchema = z
  .url()
  .max(2048)
  .refine((value) => {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !/^(localhost|.*\.localhost$|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[|.*\.local$)/i.test(
        url.hostname,
      )
    );
  }, "Use a public HTTPS address.");

// Public wire format checked against Gomnee's article-public-projection and presentation contracts.
const authorSchema = z.strictObject({
  key,
  kind: z.enum(["person", "organization"]),
  name: text(160),
  profileUrl: publicUrlSchema.nullable(),
  description: text(1000).nullable(),
});
const mediaSchema = z.strictObject({
  key,
  role: z.enum(["hero", "inline"]),
  sectionKey: key.nullable(),
  url: publicUrlSchema,
  alt: z.string().max(1000),
  decorative: z.boolean(),
  caption: text(1200).nullable(),
  credit: text(500).nullable(),
  width: z.number().int().min(1).max(30000),
  height: z.number().int().min(1).max(30000),
});
const citationSchema = z.strictObject({
  key,
  sectionKey: key,
  label: text(300),
  url: publicUrlSchema,
  locator: text(500).nullable(),
});
const richArticleFields = {
  slug: slugSchema,
  title: text(160),
  summary: text(1200),
  sections: z
    .array(
      z.strictObject({
        key,
        heading: text(240),
        markdown: z.string().min(1).max(128000),
      }),
    )
    .min(1)
    .max(30),
  presentation: z.strictObject({
    opening: z.string().min(1).max(12000).nullable(),
    authors: z.array(authorSchema).min(1).max(5),
    reviewer: authorSchema.nullable(),
    media: z.array(mediaSchema).max(16),
    citations: z.array(citationSchema).max(96),
    search: z.strictObject({
      title: text(240).nullable(),
      description: text(500).nullable(),
    }),
  }),
};
function validateArticleReferences(
  article: z.infer<z.ZodObject<typeof richArticleFields>>,
  context: z.RefinementCtx,
) {
  const keys = article.sections.map((section) => section.key);
  const media = article.presentation.media;
  if (
    new Set(keys).size !== keys.length ||
    media.filter((item) => item.role === "hero").length > 1 ||
    new Set(media.map((item) => item.key)).size !== media.length ||
    media.some((item) =>
      item.role === "inline"
        ? !keys.includes(item.sectionKey ?? "")
        : item.sectionKey !== null,
    ) ||
    media.some((item) =>
      item.decorative ? item.alt !== "" : !item.alt.trim(),
    ) ||
    article.presentation.citations.some(
      (item) => !keys.includes(item.sectionKey),
    )
  )
    context.addIssue({
      code: "custom",
      message:
        "Public references must match the sections, and images need consistent alternative text.",
    });
}
export const richArticlePayloadSchema = z
  .strictObject({
    ...richArticleFields,
    contentFormat: z.literal("gomnee_article_v1"),
  })
  .superRefine(validateArticleReferences);

// Typed modules checked against Gomnee's article-public-modules (gomnee_article_v2).
const citationKeys = z.array(key).max(32);
const isoDate = z.iso.date().max(10);
const verificationExcerptSchema = z.union([
  z.strictObject({
    key,
    sectionKey: key,
    kind: z.enum(["terminal_output", "measurement"]),
    command: text(4000).nullable(),
    content: z
      .string()
      .min(1)
      .max(6000)
      .refine((value) => Boolean(value.trim())),
    capturedAt: isoDate,
  }),
  z.strictObject({
    key,
    sectionKey: key,
    kind: z.literal("screenshot"),
    mediaKey: key,
    capturedAt: isoDate,
  }),
]);
export const typedArticlePayloadSchema = z
  .strictObject({
    ...richArticleFields,
    contentFormat: z.literal("gomnee_article_v2"),
    // Listing-card artwork only; it is never a body hero or share image.
    cover: z
      .strictObject({
        key,
        url: publicUrlSchema,
        alt: text(1000),
        caption: text(1200).nullable(),
        credit: text(500).nullable(),
        width: z.number().int().min(1).max(30000),
        height: z.number().int().min(1).max(30000),
      })
      .optional(),
    faq: z
      .array(
        z.strictObject({
          key,
          question: text(500),
          answerMarkdown: text(6000),
          sectionKey: key.nullable(),
          citationKeys,
        }),
      )
      .max(8),
    procedure: z
      .strictObject({
        sectionKey: key,
        prerequisitesMarkdown: text(12000).nullable(),
        steps: z
          .array(
            z.strictObject({
              key,
              name: text(240),
              instructionsMarkdown: text(12000),
              expectedResultMarkdown: text(6000).nullable(),
              citationKeys,
            }),
          )
          .min(1)
          .max(50),
        verificationMarkdown: text(12000).nullable(),
        troubleshootingMarkdown: text(12000).nullable(),
      })
      .nullable(),
    comparison: z
      .strictObject({
        sectionKey: key,
        methodMarkdown: text(12000),
        columns: z
          .array(z.strictObject({ key, label: text(240) }))
          .min(2)
          .max(12),
        rows: z
          .array(
            z.strictObject({
              key,
              label: text(240),
              cells: z
                .array(
                  z.strictObject({
                    columnKey: key,
                    markdown: text(6000),
                    citationKeys,
                  }),
                )
                .min(2)
                .max(12),
            }),
          )
          .min(1)
          .max(50),
        limitationsMarkdown: text(12000).nullable(),
      })
      .nullable(),
    verification: z
      .strictObject({
        mode: z.enum(["first_hand", "docs_only", "not_applicable"]),
        disclosure: text(2000).nullable(),
        lastVerifiedAt: isoDate.nullable(),
        versions: z
          .array(z.strictObject({ name: text(160), version: text(160) }))
          .max(16),
        // Absence is part of the digest; never insert a default.
        excerpts: z.array(verificationExcerptSchema).max(16).optional(),
      })
      .nullable(),
    taxonomy: z.strictObject({
      categories: z.array(text(160)).max(16),
      tags: z.array(text(160)).max(32),
    }),
  })
  .superRefine((article, context) => {
    validateArticleReferences(article, context);
    const sections = new Set(article.sections.map((section) => section.key));
    const citations = new Set(
      article.presentation.citations.map((citation) => citation.key),
    );
    const unique = (values: string[]) => new Set(values).size === values.length;
    const resolved = (keys: string[]) => keys.every((k) => citations.has(k));
    const columns = article.comparison?.columns.map((column) => column.key);
    const excerpts = article.verification?.excerpts ?? [];
    if (
      citations.size !== article.presentation.citations.length ||
      !unique(article.faq.map((item) => item.key)) ||
      !unique(article.faq.map((item) => item.question.toLocaleLowerCase())) ||
      article.faq.some(
        (item) =>
          (item.sectionKey !== null && !sections.has(item.sectionKey)) ||
          !resolved(item.citationKeys),
      ) ||
      (article.procedure &&
        (!sections.has(article.procedure.sectionKey) ||
          !unique(article.procedure.steps.map((step) => step.key)) ||
          article.procedure.steps.some(
            (step) => !resolved(step.citationKeys),
          ))) ||
      (article.comparison &&
        columns &&
        (!sections.has(article.comparison.sectionKey) ||
          !unique(columns) ||
          !unique(article.comparison.rows.map((row) => row.key)) ||
          article.comparison.rows.some(
            (row) =>
              row.cells.length !== columns.length ||
              !unique(row.cells.map((cell) => cell.columnKey)) ||
              row.cells.some(
                (cell) =>
                  !columns.includes(cell.columnKey) ||
                  !resolved(cell.citationKeys),
              ),
          ))) ||
      (excerpts.length > 0 && article.verification?.mode !== "first_hand") ||
      !unique(excerpts.map((excerpt) => excerpt.key)) ||
      excerpts.some(
        (excerpt) =>
          !sections.has(excerpt.sectionKey) ||
          (excerpt.kind === "screenshot" &&
            !article.presentation.media.some(
              (item) =>
                item.key === excerpt.mediaKey &&
                item.role === "inline" &&
                item.sectionKey === excerpt.sectionKey &&
                !item.decorative,
            )),
      )
    )
      context.addIssue({
        code: "custom",
        message:
          "Questions, procedures, comparisons and verification need unique keys and must refer to existing sections, sources and images.",
      });
  });
export const markdownArticlePayloadSchema = z.strictObject({
  slug: slugSchema,
  title: text(160),
  summary: text(1200),
  contentFormat: z.literal("markdown"),
  content: z.string().min(1).max(128000),
});
export const articlePayloadSchema = z.union([
  markdownArticlePayloadSchema,
  richArticlePayloadSchema,
  typedArticlePayloadSchema,
]);
export type ArticlePayload = z.infer<typeof articlePayloadSchema>;
export type RichArticlePayload = Exclude<
  ArticlePayload,
  { contentFormat: "markdown" }
>;
export type TypedArticlePayload = z.infer<typeof typedArticlePayloadSchema>;

const digestSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/);
// The site declares one complete-Article field; Gomnee pins the reviewed mapping.
export const mappedContentSchema = z.strictObject({
  mapping: z.strictObject({
    profileId: z.uuid(),
    version: z.number().int().positive(),
    digest: digestSchema,
    destinationShapeDigest: digestSchema,
  }),
  fields: z.tuple([
    z.strictObject({
      key: z.literal("content"),
      type: z.literal("article"),
      value: typedArticlePayloadSchema,
    }),
  ]),
});
export type MappedContent = z.infer<typeof mappedContentSchema>;

const requestFields = {
  commandId: z.uuid(),
  articleRevisionId: z.uuid(),
  expectedRemoteVersion: z.number().int().positive().nullable(),
  contentDigest: digestSchema,
};
export const publishRequestSchema = z.union([
  z.strictObject({
    schemaVersion: z.literal("gomnee_live_article_publish_v1"),
    ...requestFields,
    article: markdownArticlePayloadSchema,
  }),
  z.strictObject({
    schemaVersion: z.literal("gomnee_live_article_publish_v2"),
    ...requestFields,
    article: richArticlePayloadSchema,
  }),
  z.strictObject({
    schemaVersion: z.literal("gomnee_live_article_publish_v3"),
    ...requestFields,
    article: typedArticlePayloadSchema,
    mappedContent: mappedContentSchema,
  }),
]);
export type PublishRequest = z.infer<typeof publishRequestSchema>;
