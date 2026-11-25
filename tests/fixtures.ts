import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { PUT } from "@/app/api/integrations/gomnee/publishing/v1/articles/[articleKey]/route";
import { articlePayloadSchema, typedArticlePayloadSchema, type ArticlePayload } from "@/lib/publishing/contract";
import { makePublishRequest } from "@/lib/publishing/publish";

export const KEY = process.env.GOMNEE_PUBLISHING_TOKEN!;

/** A Markdown Article: Gomnee's simplest format, with no authors or modules. */
export function markdownArticle(slug = "hello-from-gomnee") {
  return articlePayloadSchema.parse({
    slug,
    title: "Hello from Gomnee",
    summary: "The first Article Gomnee published here.",
    contentFormat: "markdown",
    content: "## What this is\n\nA short Article.\n\n<script>alert('no')</script>",
  });
}

/** A gomnee_article_v2 document with every typed module Gomnee can send. */
export function typedArticle(slug = "compare-two-proposals") {
  return typedArticlePayloadSchema.parse({
    slug,
    title: "Compare two proposals step by step",
    summary: "Questions, steps and a comparison for reading two proposals.",
    contentFormat: "gomnee_article_v2",
    sections: [
      { key: "why", heading: "Why compare", markdown: "Two proposals rarely describe the same work.\n\n<img src=x onerror=alert(1)>" },
      { key: "steps", heading: "How to compare", markdown: "Work through them in order." },
      { key: "sources", heading: "Side by side", markdown: "The main differences, [with a guide](https://docs.example.org/guide)." },
    ],
    presentation: {
      opening: "Read both proposals with the same questions.",
      authors: [
        {
          key: "ada",
          kind: "person",
          name: "Ada Example",
          profileUrl: "https://ada.example.org/",
          description: "Ada writes about buying professional services.",
        },
      ],
      reviewer: null,
      media: [
        {
          key: "hero",
          role: "hero",
          sectionKey: null,
          url: "https://images.example.org/hero.png",
          alt: "Two documents side by side",
          decorative: false,
          caption: "Two proposals",
          credit: null,
          width: 1600,
          height: 900,
        },
      ],
      citations: [
        { key: "guide", sectionKey: "why", label: "A public guide", url: "https://docs.example.org/guide", locator: "Section 2" },
        { key: "guide-again", sectionKey: "sources", label: "A public guide", url: "https://docs.example.org/guide", locator: "Section 3" },
      ],
      search: { title: null, description: null },
    },
    cover: {
      key: "cover",
      url: "https://images.example.org/cover.png",
      alt: "A cover for the guide",
      caption: null,
      credit: null,
      width: 1200,
      height: 630,
    },
    faq: [
      {
        key: "difference",
        question: "What differs most?",
        answerMarkdown: "The **scope** of the work.",
        sectionKey: "why",
        citationKeys: ["guide"],
      },
      { key: "guarantee", question: "Can anyone guarantee results?", answerMarkdown: "No.", sectionKey: null, citationKeys: [] },
    ],
    procedure: {
      sectionKey: "steps",
      prerequisitesMarkdown: "Collect both proposals.",
      steps: [
        {
          key: "list",
          name: "List the work",
          instructionsMarkdown: "Write down each task.",
          expectedResultMarkdown: "A list you can compare.",
          citationKeys: [],
        },
        { key: "ask", name: "Ask for evidence", instructionsMarkdown: "Ask for examples.", expectedResultMarkdown: null, citationKeys: ["guide"] },
      ],
      verificationMarkdown: null,
      troubleshootingMarkdown: "Ask for a written proposal.",
    },
    comparison: {
      sectionKey: "sources",
      methodMarkdown: "We compare what each proposal says it includes.",
      columns: [
        { key: "first", label: "First proposal" },
        { key: "second", label: "Second proposal" },
      ],
      rows: [
        {
          key: "goal",
          label: "Goal",
          cells: [
            { columnKey: "first", markdown: "Search results", citationKeys: [] },
            { columnKey: "second", markdown: "AI answers", citationKeys: ["guide-again"] },
          ],
        },
      ],
      limitationsMarkdown: null,
    },
    verification: {
      mode: "docs_only",
      disclosure: "Based on public documentation.",
      lastVerifiedAt: "2026-11-20",
      versions: [],
    },
    taxonomy: { categories: ["Guides"], tags: ["Proposals"] },
  });
}

export const MAPPING = { profileId: randomUUID(), version: 1, digest: `sha256:${"a".repeat(64)}` };

export function ids(expectedRemoteVersion: number | null = null) {
  return { commandId: randomUUID(), articleRevisionId: randomUUID(), expectedRemoteVersion };
}

/** Calls the live PUT route the way Gomnee does. */
export async function put(articleKey: string, body: unknown, key = KEY) {
  const response = await PUT(
    new Request(`https://example.com/api/integrations/gomnee/publishing/v1/articles/${articleKey}`, {
      method: "PUT",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ articleKey }) },
  );
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

/** Publishes an Article as Gomnee would, typed ones mapped (v3), and returns its key. */
export async function publish(article: ArticlePayload = markdownArticle()) {
  const articleKey = randomUUID();
  const request =
    article.contentFormat === "gomnee_article_v2"
      ? makePublishRequest(article, ids(), MAPPING)
      : makePublishRequest(article, ids());
  const result = await put(articleKey, request);
  if (result.status !== 200) throw new Error(`publish failed: ${JSON.stringify(result.body)}`);
  return articleKey;
}

export async function emptyDatabase() {
  await getDb().execute(sql`truncate publication_commands, articles, article_previews`);
}
