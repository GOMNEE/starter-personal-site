import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

/**
 * The only module that reads Articles. Pages, the sitemap and structured data
 * go through it, so the source can change later (for example to the storage
 * behind the publishing destination you agree with Gomnee) without touching a
 * route or template.
 */
export type Article = Readonly<{
  slug: string;
  title: string;
  description: string;
  /** ISO dates (YYYY-MM-DD): first publication and last real change. */
  published: string;
  updated: string;
  author: string;
  /** Markdown. The template renders the title as the page's only h1. */
  body: string;
}>;

const DIRECTORY = path.join(process.cwd(), "content", "articles");
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const isoDate = (value: unknown) =>
  value instanceof Date ? value.toISOString().slice(0, 10) : String(value ?? "");

function readArticle(file: string): Article {
  const slug = file.replace(/\.md$/, "");
  if (!SLUG.test(slug)) throw new Error(`${file}: use a lowercase, hyphenated slug`);
  const { data, content } = matter(fs.readFileSync(path.join(DIRECTORY, file), "utf8"));
  const article = {
    slug,
    title: String(data.title ?? ""),
    description: String(data.description ?? ""),
    published: isoDate(data.published),
    updated: isoDate(data.updated ?? data.published),
    author: String(data.author ?? ""),
    body: content.trim(),
  };
  for (const [field, value] of Object.entries(article))
    if (!value) throw new Error(`${file}: "${field}" is missing`);
  return article;
}

/** Newest first. */
export function listArticles(): Article[] {
  if (!fs.existsSync(DIRECTORY)) return [];
  return fs
    .readdirSync(DIRECTORY)
    .filter((file) => file.endsWith(".md"))
    .map(readArticle)
    .sort((a, b) => b.published.localeCompare(a.published));
}

export function getArticle(slug: string): Article | undefined {
  return listArticles().find((article) => article.slug === slug);
}
