import { eq } from "drizzle-orm";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeDb, getDb } from "@/db";
import { articles } from "@/db/schema";
import ArticleRoute, { generateMetadata } from "@/app/blog/[slug]/page";
import BlogIndex from "@/app/blog/page";
import sitemap from "@/app/sitemap";
import { SITE } from "@/lib/site";
import { emptyDatabase, markdownArticle, publish, typedArticle } from "./fixtures";

async function render(slug: string) {
  return renderToStaticMarkup(await ArticleRoute({ params: Promise.resolve({ slug }) }));
}

function jsonLd(html: string) {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(
    ([, json]) => JSON.parse(json!) as Record<string, unknown>,
  );
}

beforeEach(emptyDatabase);
afterAll(closeDb);

describe("article pages", () => {
  it("render every module of a typed Article once, with one h1 and matching structured data", async () => {
    await publish(typedArticle());
    const html = await render("compare-two-proposals");
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    for (const part of [
      "In short",
      "Two documents side by side",
      "Before you start",
      "Expected result",
      "If something doesn&#x27;t work",
      "How this comparison works",
      "First proposal",
      "What differs most?",
      "Can anyone guarantee results?",
      "How this was checked",
      "Based on documentation",
      "About the author",
    ])
      expect(html).toContain(part);
    // One numbered list, one entry per URL, with both locators.
    expect(html).toContain("Section 2; Section 3");
    expect(html.match(/<li id="source-/g)).toHaveLength(1);
    // Raw HTML in content is skipped, never injected.
    expect(html).not.toContain("<img src=\"x\"");
    expect(html).not.toContain("onerror");

    const [posting, breadcrumbs, faq] = jsonLd(html);
    expect(posting).toMatchObject({
      "@type": "BlogPosting",
      headline: "Compare two proposals step by step",
      author: [{ "@type": "Person", name: "Ada Example", url: "https://ada.example.org/" }],
      image: "https://images.example.org/hero.png",
      citation: ["https://docs.example.org/guide"],
    });
    expect(String(posting!.datePublished)).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(breadcrumbs!["@type"]).toBe("BreadcrumbList");
    expect(faq!["@type"]).toBe("FAQPage");
  });

  it("credit a Markdown Article to the site's owner", async () => {
    await publish(markdownArticle());
    const html = await render("hello-from-gomnee");
    expect(html).toContain(`By <span><a href="${SITE.url}/about">${SITE.name}</a></span>`);
    expect(html).not.toContain("alert(");
    const [posting] = jsonLd(html);
    expect(posting!.author).toEqual([{ "@type": "Person", "@id": `${SITE.url}/#person`, name: SITE.name }]);
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: "hello-from-gomnee" }) });
    expect(metadata.alternates?.canonical).toBe("/blog/hello-from-gomnee");
  });

  it("list published Articles in the index and the sitemap, and hide archived ones", async () => {
    await publish(typedArticle());
    await publish(markdownArticle());
    let index = renderToStaticMarkup(await BlogIndex());
    expect(index).toContain("Compare two proposals step by step");
    expect(index).toContain("https://images.example.org/cover.png");
    expect((await sitemap()).map((entry) => entry.url)).toContain(`${SITE.url}/blog/hello-from-gomnee`);

    await getDb().update(articles).set({ status: "archived" }).where(eq(articles.slug, "hello-from-gomnee"));
    index = renderToStaticMarkup(await BlogIndex());
    expect(index).not.toContain("Hello from Gomnee");
    expect((await sitemap()).map((entry) => entry.url)).not.toContain(`${SITE.url}/blog/hello-from-gomnee`);
    await expect(render("hello-from-gomnee")).rejects.toThrow();
  });
});
