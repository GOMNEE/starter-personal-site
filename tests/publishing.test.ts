import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeDb, getDb } from "@/db";
import { articles } from "@/db/schema";
import { GET as capabilities } from "@/app/api/integrations/gomnee/publishing/v1/route";
import { GET as readBack } from "@/app/api/integrations/gomnee/publishing/v1/articles/[articleKey]/route";
import { contentDigest, DESTINATION_SHAPE, makePublishRequest, TEMPLATE } from "@/lib/publishing/publish";
import { SITE } from "@/lib/site";
import { emptyDatabase, ids, KEY, MAPPING, markdownArticle, put, typedArticle } from "./fixtures";

const base = "https://example.com/api/integrations/gomnee/publishing/v1";
const auth = (key = KEY) => ({ authorization: `Bearer ${key}` });

async function read(articleKey: string) {
  const response = await readBack(new Request(`${base}/articles/${articleKey}`, { headers: auth() }), {
    params: Promise.resolve({ articleKey }),
  });
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

beforeEach(emptyDatabase);
afterAll(closeDb);

describe("capabilities", () => {
  it("declares the neutral Custom Website destination for this site's origin", async () => {
    const response = await capabilities(new Request(base, { headers: auth() }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      schemaVersion: "gomnee_publishing_capabilities_v2",
      adapterKey: "gomnee.custom_website_articles",
      siteOrigin: new URL(SITE.url).origin,
      contentFormats: ["markdown", "gomnee_article_v1", "gomnee_article_v2"],
      template: TEMPLATE,
      destinationShape: DESTINATION_SHAPE,
      coverPlacement: "listing_card",
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("refuses a wrong key, and says when publishing is not configured", async () => {
    expect((await capabilities(new Request(base, { headers: auth("x".repeat(40)) }))).status).toBe(401);
    expect((await capabilities(new Request(base))).status).toBe(401);
    const saved = process.env.GOMNEE_PUBLISHING_TOKEN;
    delete process.env.GOMNEE_PUBLISHING_TOKEN;
    try {
      expect((await capabilities(new Request(base, { headers: auth() }))).status).toBe(503);
    } finally {
      process.env.GOMNEE_PUBLISHING_TOKEN = saved;
    }
  });
});

describe("publishing", () => {
  it("creates, reads back, updates and reconciles an exact retry", async () => {
    const articleKey = randomUUID();
    const article = markdownArticle();
    const create = makePublishRequest(article, ids());
    const created = await put(articleKey, create);
    expect(created.status).toBe(200);
    expect(created.body).toMatchObject({
      schemaVersion: "gomnee_live_article_receipt_v1",
      operation: "created",
      remoteVersion: 1,
      publicUrl: `${new URL(SITE.url).origin}/blog/${article.slug}`,
      contentDigest: contentDigest(article),
    });

    const observed = await read(articleKey);
    expect(observed.status).toBe(200);
    expect(observed.body).toMatchObject({ schemaVersion: "gomnee_live_article_observation_v1", remoteVersion: 1 });
    expect(observed.body.article).toEqual(article);

    const changed = { ...article, summary: "Updated summary." };
    const updated = await put(articleKey, makePublishRequest(changed, ids(1)));
    expect(updated.body).toMatchObject({ operation: "updated", remoteVersion: 2 });

    // The exact first command again: its original receipt, content untouched.
    const replay = await put(articleKey, create);
    expect(replay.body).toMatchObject({ operation: "reconciled", remoteVersion: 1 });
    expect((await read(articleKey)).body).toMatchObject({ remoteVersion: 2, summary: "Updated summary." });
  });

  it("refuses stale versions, changed slugs, reused commands and wrong digests without changing anything", async () => {
    const articleKey = randomUUID();
    const article = markdownArticle();
    const create = makePublishRequest(article, ids());
    await put(articleKey, create);

    expect((await put(articleKey, makePublishRequest(article, ids(7)))).status).toBe(409);
    expect((await put(articleKey, makePublishRequest({ ...article, slug: "another-address" }, ids(1)))).status).toBe(409);
    expect((await put(articleKey, { ...create, article: { ...article, title: "Other" } })).status).toBe(400);
    const reused = makePublishRequest({ ...article, title: "Other" }, { ...ids(1), commandId: create.commandId });
    expect((await put(articleKey, reused)).status).toBe(409);
    expect((await put(randomUUID(), makePublishRequest(article, ids()))).status).toBe(409);
    expect((await put(randomUUID(), makePublishRequest(markdownArticle("never-published"), ids(1)))).status).toBe(409);
    expect((await put(articleKey, { ...create, article: { ...article, unexpected: true } })).status).toBe(400);

    expect((await read(articleKey)).body).toMatchObject({ remoteVersion: 1, title: article.title });
  });

  it("publishes a mapped typed Article and returns the complete pair on read-back", async () => {
    const articleKey = randomUUID();
    const article = typedArticle();
    const request = makePublishRequest(article, ids(), MAPPING);
    const receipt = await put(articleKey, request);
    expect(receipt.status).toBe(200);
    expect(receipt.body).toMatchObject({
      schemaVersion: "gomnee_live_article_receipt_v2",
      mapping: { ...MAPPING, destinationShapeDigest: contentDigest(DESTINATION_SHAPE) },
    });
    const observed = await read(articleKey);
    expect(observed.body.schemaVersion).toBe("gomnee_live_article_observation_v2");
    expect(observed.body.article).toEqual(article);
    expect(observed.body.mappedContent).toEqual(request.mappedContent);

    const stale = makePublishRequest(article, ids(1), MAPPING);
    stale.mappedContent.mapping.destinationShapeDigest = `sha256:${"b".repeat(64)}`;
    stale.contentDigest = contentDigest({ article, mappedContent: stale.mappedContent });
    expect((await put(articleKey, stale)).status).toBe(409);
  });

  it("keeps an archived Article out of read-back and refuses to update it", async () => {
    const articleKey = randomUUID();
    await put(articleKey, makePublishRequest(markdownArticle(), ids()));
    await getDb().update(articles).set({ status: "archived" }).where(eq(articles.gomneeArticleKey, articleKey));
    expect((await read(articleKey)).status).toBe(404);
    expect((await put(articleKey, makePublishRequest(markdownArticle(), ids(1)))).status).toBe(409);
  });
});
