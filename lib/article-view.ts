import type { ArticlePayload, RichArticlePayload } from "@/lib/publishing/contract";
import { SITE } from "@/lib/site";

type Citation = RichArticlePayload["presentation"]["citations"][number];

/** One public source: every citation of the same URL shares its number. */
export type SourceEntry = {
  number: number;
  /** The list entry's anchor, from the first citation with this URL. */
  anchor: string;
  label: string;
  url: string;
  locators: string[];
};
export type SourceIndex = {
  entries: SourceEntry[];
  byKey: ReadonlyMap<string, SourceEntry>;
  /** Sources each section cites, in ascending number order. */
  bySection: ReadonlyMap<string, SourceEntry[]>;
};

/** Numbers sources once per URL, in payload order, and merges their locators. */
export function buildSourceIndex(citations: readonly Citation[]): SourceIndex {
  const entries: SourceEntry[] = [];
  const byUrl = new Map<string, SourceEntry>();
  const byKey = new Map<string, SourceEntry>();
  const bySection = new Map<string, SourceEntry[]>();
  for (const citation of citations) {
    let entry = byUrl.get(citation.url);
    if (!entry) {
      entry = {
        number: entries.length + 1,
        anchor: `source-${citation.key}`,
        label: citation.label,
        url: citation.url,
        locators: [],
      };
      entries.push(entry);
      byUrl.set(citation.url, entry);
    }
    if (citation.locator && !entry.locators.includes(citation.locator)) entry.locators.push(citation.locator);
    byKey.set(citation.key, entry);
    const section = bySection.get(citation.sectionKey) ?? [];
    if (!section.includes(entry)) section.push(entry);
    bySection.set(citation.sectionKey, section);
  }
  for (const section of bySection.values()) section.sort((a, b) => a.number - b.number);
  return { entries, byKey, bySection };
}

/** A module's citation keys as unique sources, in ascending number order. */
export function sourceRefs(index: SourceIndex, keys: readonly string[]) {
  return [
    ...new Set(
      keys.flatMap((key) => {
        const entry = index.byKey.get(key);
        return entry ? [entry] : [];
      }),
    ),
  ].sort((a, b) => a.number - b.number);
}

/** Sources any cell of a comparison row cites, listed once for the row. */
export function rowSourceRefs(index: SourceIndex, cells: readonly { citationKeys: string[] }[]) {
  return sourceRefs(
    index,
    cells.flatMap((cell) => cell.citationKeys),
  );
}

export type ArticleLink =
  | { kind: "internal"; href: string }
  | { kind: "external"; href: string }
  | { kind: "plain"; href: string | undefined };
/**
 * Classifies a link in Article content. An absolute URL on this site becomes a
 * root-relative path, so it stays on whichever address serves the page.
 */
export function articleLink(href: string | undefined, siteOrigins: readonly string[] = [new URL(SITE.url).origin]): ArticleLink {
  if (!href) return { kind: "plain", href };
  if (href.startsWith("/") && !href.startsWith("//")) return { kind: "internal", href };
  if (!/^https?:\/\//i.test(href)) return { kind: "plain", href };
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return { kind: "plain", href };
  }
  return siteOrigins.includes(url.origin)
    ? { kind: "internal", href: `${url.pathname}${url.search}${url.hash}` }
    : { kind: "external", href };
}

// Fixed anchors the page and typed modules use; section keys never take them.
export const ANCHORS = {
  procedure: "procedure",
  comparison: "comparison",
  questions: "questions",
  sources: "sources",
  verification: "how-this-was-checked",
} as const;
const RESERVED_PREFIXES = ["step-", "question-", "image-", "source-", "excerpt-"];

/** Section key → an element id that cannot collide with a module's anchor. */
export function sectionAnchors(keys: readonly string[]) {
  const reserved = new Set<string>(Object.values(ANCHORS));
  const anchors = new Map<string, string>();
  const used = new Set(keys);
  for (const key of keys) {
    if (!reserved.has(key) && !RESERVED_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      anchors.set(key, key);
      continue;
    }
    let anchor = `section-${key}`;
    for (let n = 2; used.has(anchor); n++) anchor = `section-${key}-${n}`;
    used.add(anchor);
    anchors.set(key, anchor);
  }
  return anchors;
}

export type ContentsEntry = { id: string; label: string };
/** Anchors, numbered sources and the contents, shared by the page and its body. */
export function articleOutline(payload: ArticlePayload) {
  if (payload.contentFormat === "markdown")
    return { anchors: new Map<string, string>(), sources: buildSourceIndex([]), contents: [] as ContentsEntry[] };
  const typed = payload.contentFormat === "gomnee_article_v2" ? payload : null;
  const anchors = sectionAnchors(payload.sections.map((section) => section.key));
  const sources = buildSourceIndex(payload.presentation.citations);
  const contents: ContentsEntry[] = [
    ...payload.sections.map((section) => ({ id: anchors.get(section.key)!, label: section.heading })),
    ...(typed?.faq.some((item) => item.sectionKey === null) ? [{ id: ANCHORS.questions, label: "Questions" }] : []),
    ...(sources.entries.length ? [{ id: ANCHORS.sources, label: "Sources" }] : []),
    ...(typed?.verification ? [{ id: ANCHORS.verification, label: "How this was checked" }] : []),
  ];
  return { anchors, sources, contents };
}
export type ArticleOutline = ReturnType<typeof articleOutline>;

const WORDS_PER_MINUTE = 220;
/** Estimated reading time of the visible text, rounded up. */
export function readingMinutes(payload: ArticlePayload) {
  const parts: string[] = [];
  if (payload.contentFormat === "markdown") parts.push(payload.content);
  else {
    parts.push(payload.presentation.opening ?? "");
    for (const section of payload.sections) parts.push(section.heading, section.markdown);
  }
  if (payload.contentFormat === "gomnee_article_v2") {
    for (const item of payload.faq) parts.push(item.question, item.answerMarkdown);
    const procedure = payload.procedure;
    if (procedure)
      parts.push(
        procedure.prerequisitesMarkdown ?? "",
        ...procedure.steps.flatMap((step) => [step.name, step.instructionsMarkdown, step.expectedResultMarkdown ?? ""]),
        procedure.verificationMarkdown ?? "",
        procedure.troubleshootingMarkdown ?? "",
      );
    const comparison = payload.comparison;
    if (comparison)
      parts.push(
        comparison.methodMarkdown,
        ...comparison.rows.flatMap((row) => [row.label, ...row.cells.map((cell) => cell.markdown)]),
        comparison.limitationsMarkdown ?? "",
      );
  }
  const words = parts
    // A cheap estimate: drop link targets and Markdown symbols, then count words.
    .flatMap((part) =>
      part
        .replace(/\]\([^)]*\)/g, " ")
        .replace(/[#>*_`|[\]~-]/g, " ")
        .split(/\s+/),
    )
    .filter(Boolean).length;
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}

export function articleCategories(payload: ArticlePayload): readonly string[] {
  return payload.contentFormat === "gomnee_article_v2" ? payload.taxonomy.categories : [];
}

export function articleTags(payload: ArticlePayload): readonly string[] {
  return payload.contentFormat === "gomnee_article_v2" ? payload.taxonomy.tags : [];
}

/** The hero image, when the Article has a real (non-decorative) one. */
export function heroImage(payload: ArticlePayload) {
  if (payload.contentFormat === "markdown") return null;
  return payload.presentation.media.find((item) => item.role === "hero" && !item.decorative) ?? null;
}

/** The title and description search engines see: the Article's own overrides first. */
export function searchFields(payload: ArticlePayload) {
  const search = payload.contentFormat === "markdown" ? null : payload.presentation.search;
  return { title: search?.title ?? payload.title, description: search?.description ?? payload.summary };
}
