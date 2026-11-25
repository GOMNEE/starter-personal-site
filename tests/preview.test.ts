import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeDb, getDb } from "@/db";
import { articlePreviews } from "@/db/schema";
import { POST } from "@/app/api/integrations/gomnee/publishing/v1/previews/route";
import ArticlePreviewPage, { metadata } from "@/app/article-preview/[token]/page";
import nextConfig, { previewFrameAncestors } from "@/next.config";
import { contentDigest, TEMPLATE } from "@/lib/publishing/publish";
import { getArticlePreview, MAX_ACTIVE_ARTICLE_PREVIEWS } from "@/lib/publishing/preview";
import { emptyDatabase, KEY, markdownArticle, typedArticle } from "./fixtures";

function request(article: ReturnType<typeof markdownArticle> | ReturnType<typeof typedArticle> = typedArticle()) {
  return {
    schemaVersion: "gomnee_article_preview_request_v1",
    articleKey: randomUUID(),
    sourceRevisionId: randomUUID(),
    snapshotKind: "saved",
    contentDigest: contentDigest(article),
    template: TEMPLATE,
    article,
  };
}

async function post(body: unknown) {
  const response = await POST(
    new Request("https://example.com/api/integrations/gomnee/publishing/v1/previews", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${KEY}` },
      body: JSON.stringify(body),
    }),
  );
  return { status: response.status, body: (await response.json()) as Record<string, string>, response };
}

const tokenOf = (previewUrl: string) => new URL(previewUrl).pathname.split("/").at(-1)!;

beforeEach(emptyDatabase);
afterAll(closeDb);

describe("private previews", () => {
  it("returns an expiring private URL that renders the snapshot without publishing it", async () => {
    const { status, body, response } = await post(request());
    expect(status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(body.schemaVersion).toBe("gomnee_article_preview_receipt_v1");
    expect(new URL(body.previewUrl).pathname).toMatch(/^\/article-preview\/[A-Za-z0-9_-]{43}$/);
    const lifetime = new Date(body.expiresAt).getTime() - Date.now();
    expect(lifetime).toBeGreaterThan(13 * 60_000);
    expect(lifetime).toBeLessThanOrEqual(15 * 60_000);

    const page = await ArticlePreviewPage({ params: Promise.resolve({ token: tokenOf(body.previewUrl) }) });
    const html = renderToStaticMarkup(page);
    expect(html).toContain("Private preview · Saved draft · Not published");
    expect(html).toContain("Compare two proposals step by step");
    expect(html).not.toContain("application/ld+json");
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
    const [stored] = await getDb().select().from(articlePreviews);
    expect(stored!.tokenHash).not.toContain(tokenOf(body.previewUrl));
  });

  it("refuses a wrong digest or an outdated template", async () => {
    expect((await post({ ...request(), contentDigest: `sha256:${"0".repeat(64)}` })).status).toBe(400);
    expect((await post({ ...request(), template: { id: TEMPLATE.id, version: "0" } })).status).toBe(409);
  });

  it("forgets expired previews and admits at most a hundred at once", async () => {
    const { body } = await post(request(markdownArticle()));
    await getDb().execute(
      sql`update article_previews set created_at = now() - interval '20 minutes', expires_at = now() - interval '6 minutes'`,
    );
    expect(await getArticlePreview(tokenOf(body.previewUrl))).toBeNull();

    for (let index = 0; index < MAX_ACTIVE_ARTICLE_PREVIEWS; index++)
      expect((await post(request(markdownArticle()))).status).toBe(201);
    expect((await post(request(markdownArticle()))).status).toBe(429);
  });
});

describe("framing", () => {
  it("lets only Gomnee frame previews and denies framing everywhere else", async () => {
    const rules = await nextConfig.headers!();
    const preview = rules.find((rule) => rule.source === "/article-preview/:path*")!;
    expect(preview.headers).toContainEqual({ key: "Content-Security-Policy", value: "frame-ancestors https://app.gomnee.com;" });
    expect(preview.headers).toContainEqual({ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" });
    const pages = rules.find((rule) => rule.headers.some((header) => header.key === "X-Frame-Options"))!;
    expect(new RegExp(`^${pages.source.replace("/((?!", "/(?!").replace(").*)", ").*")}$`).test("/blog/a")).toBe(true);
    expect(previewFrameAncestors("https://staging.gomnee.com")).toBe(
      "frame-ancestors https://app.gomnee.com https://staging.gomnee.com;",
    );
    expect(() => previewFrameAncestors("http://insecure.example.com")).toThrow();
    expect(() => previewFrameAncestors("https://*.example.com")).toThrow();
  });
});
