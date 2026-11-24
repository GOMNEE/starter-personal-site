import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

/**
 * Articles follow Gomnee's Article document
 * (https://gomnee.com/schemas/gomnee-article-v2.json): the same names for the
 * same things, so one page renders an article written here today and one
 * Gomnee publishes later. This is the only module that reads them; when the
 * site reads its Articles from Gomnee, only this file changes.
 *
 * Only title, summary, published and authors are required. The page shows
 * every other part only when an article has it.
 */
export type Person = Readonly<{
  name: string;
  kind: "person" | "organization";
  url: string | null;
  description: string | null;
}>;

export type Article = Readonly<{
  slug: string;
  title: string;
  /** Shown under the title; the meta description when search has none. */
  summary: string;
  search: Readonly<{ title: string | null; description: string | null }>;
  /** ISO dates (YYYY-MM-DD): first publication and last real change. */
  published: string;
  updated: string;
  authors: readonly Person[];
  reviewer: Person | null;
  cover: Readonly<{
    src: string;
    alt: string;
    width: number;
    height: number;
    caption: string | null;
    credit: string | null;
  }> | null;
  categories: readonly string[];
  tags: readonly string[];
  faq: readonly Readonly<{ question: string; answer: string }>[];
  sources: readonly Readonly<{ label: string; url: string }>[];
  verification: Readonly<{
    mode: "first_hand" | "docs_only";
    note: string | null;
    lastVerified: string | null;
  }> | null;
  /** Markdown. The page shows the title as its only h1, so this starts at h2. */
  body: string;
  /** The body's h2 headings, for the page's contents. */
  sections: readonly Readonly<{ id: string; heading: string }>[];
  readingMinutes: number;
}>;

const DIRECTORY = path.join(process.cwd(), "content", "articles");
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

type Fields = Record<string, unknown>;

class ArticleError extends Error {
  constructor(file: string, field: string, problem: string) {
    super(`content/articles/${file}: "${field}" ${problem}`);
  }
}

function text(data: Fields, field: string, file: string): string {
  const value = data[field];
  if (typeof value !== "string" || !value.trim())
    throw new ArticleError(file, field, "is required text");
  return value.trim();
}

function optionalText(data: Fields, field: string, file: string): string | null {
  const value = data[field];
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new ArticleError(file, field, "must be text");
  return value.trim();
}

function date(data: Fields, field: string, file: string, fallback?: string): string {
  const value = data[field] ?? fallback;
  const iso = value instanceof Date ? value.toISOString().slice(0, 10) : String(value ?? "");
  if (!DATE.test(iso)) throw new ArticleError(file, field, "must be a date, YYYY-MM-DD");
  return iso;
}

function list<T>(data: Fields, field: string, file: string, read: (item: unknown, at: string) => T): T[] {
  const value = data[field];
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new ArticleError(file, field, "must be a list");
  return value.map((item, index) => read(item, `${field}[${index}]`));
}

function person(item: unknown, at: string, file: string): Person {
  if (typeof item === "string" && item.trim())
    return { name: item.trim(), kind: "person", url: null, description: null };
  if (!item || typeof item !== "object") throw new ArticleError(file, at, "must be a name or { name, url, description }");
  const fields = item as Fields;
  const kind = fields.kind ?? "person";
  if (kind !== "person" && kind !== "organization")
    throw new ArticleError(file, `${at}.kind`, 'must be "person" or "organization"');
  return {
    name: text(fields, "name", file),
    kind,
    url: optionalText(fields, "url", file),
    description: optionalText(fields, "description", file),
  };
}

/** Plain text of a Markdown heading, and a stable id for it. */
export function headingText(markdown: string): string {
  return markdown
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`~]/g, "")
    .trim();
}
export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "section"
  );
}
/** Ids for headings in order, numbering repeats: intro, intro-2. */
export function headingIds(headings: readonly string[]): string[] {
  const seen = new Map<string, number>();
  return headings.map((heading) => {
    const base = slugify(heading);
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    return count === 1 ? base : `${base}-${count}`;
  });
}

function sectionsOf(body: string) {
  let fenced = false;
  const headings: string[] = [];
  for (const line of body.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
    const match = !fenced && line.match(/^##\s+(.+?)\s*#*\s*$/);
    if (match) headings.push(headingText(match[1]!));
  }
  const ids = headingIds(headings);
  return headings.map((heading, index) => ({ id: ids[index]!, heading }));
}

function readArticle(file: string): Article {
  const slug = file.replace(/\.md$/, "");
  if (!SLUG.test(slug)) throw new ArticleError(file, "file name", "must be lowercase words joined by hyphens");
  const { data, content } = matter(fs.readFileSync(path.join(DIRECTORY, file), "utf8"));
  const fields = data as Fields;
  const published = date(fields, "published", file);
  const authors = list(fields, "authors", file, (item, at) => person(item, at, file));
  if (!authors.length) throw new ArticleError(file, "authors", "needs at least one author");
  const coverFields = fields.cover as Fields | undefined;
  const verificationFields = fields.verification as Fields | undefined;
  const searchFields = (fields.search ?? {}) as Fields;
  const body = content.trim();
  const words = body.split(/\s+/).filter(Boolean).length;
  const mode = verificationFields?.mode;
  if (verificationFields && mode !== "first_hand" && mode !== "docs_only")
    throw new ArticleError(file, "verification.mode", 'must be "first_hand" or "docs_only"');
  return {
    slug,
    title: text(fields, "title", file),
    summary: text(fields, "summary", file),
    search: {
      title: optionalText(searchFields, "title", file),
      description: optionalText(searchFields, "description", file),
    },
    published,
    updated: date(fields, "updated", file, published),
    authors,
    reviewer: fields.reviewer ? person(fields.reviewer, "reviewer", file) : null,
    cover: coverFields
      ? {
          src: text(coverFields, "src", file),
          alt: text(coverFields, "alt", file),
          width: Number(coverFields.width) || 1200,
          height: Number(coverFields.height) || 630,
          caption: optionalText(coverFields, "caption", file),
          credit: optionalText(coverFields, "credit", file),
        }
      : null,
    categories: list(fields, "categories", file, (item) => String(item)),
    tags: list(fields, "tags", file, (item) => String(item)),
    faq: list(fields, "faq", file, (item) => {
      const entry = (item ?? {}) as Fields;
      return { question: text(entry, "question", file), answer: text(entry, "answer", file) };
    }),
    sources: list(fields, "sources", file, (item) => {
      const entry = (item ?? {}) as Fields;
      return { label: text(entry, "label", file), url: text(entry, "url", file) };
    }),
    verification: verificationFields
      ? {
          mode: mode as "first_hand" | "docs_only",
          note: optionalText(verificationFields, "note", file),
          lastVerified: verificationFields.lastVerified ? date(verificationFields, "lastVerified", file) : null,
        }
      : null,
    body,
    sections: sectionsOf(body),
    readingMinutes: Math.max(1, Math.ceil(words / 220)),
  };
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

/** Up to three other articles: the same category first, then the newest. */
export function relatedArticles(article: Article, limit = 3): Article[] {
  const others = listArticles().filter((other) => other.slug !== article.slug);
  const shares = (other: Article) => other.categories.some((category) => article.categories.includes(category));
  return [...others.filter(shares), ...others.filter((other) => !shares(other))].slice(0, limit);
}
