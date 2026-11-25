import Link from "next/link";
import type { ReactNode } from "react";
import { ArticleBody, VERIFICATION_MODES } from "@/components/article-body";
import { DateText, dayOf } from "@/components/date";
import { JsonLd, PERSON_ID } from "@/components/json-ld";
import {
  articleCategories,
  articleOutline,
  articleTags,
  heroImage,
  readingMinutes,
  searchFields,
} from "@/lib/article-view";
import type { ArticleSummary } from "@/lib/articles";
import type { ArticlePayload } from "@/lib/publishing/contract";
import { articlePath } from "@/lib/publishing/publish";
import { SITE, absoluteUrl } from "@/lib/site";

type Person = Readonly<{
  kind: "person" | "organization";
  name: string;
  profileUrl: string | null;
  description: string | null;
  /** The site's own person, described once on the home page. */
  isSite?: boolean;
}>;

/** Who wrote it. A Markdown Article carries no authors: it is the site owner's. */
function authorsOf(payload: ArticlePayload): Person[] {
  if (payload.contentFormat === "markdown")
    return [{ kind: "person", name: SITE.name, profileUrl: absoluteUrl("/about"), description: null, isSite: true }];
  return payload.presentation.authors;
}

function Name({ person }: { person: Person }) {
  return person.profileUrl ? <a href={person.profileUrl}>{person.name}</a> : <>{person.name}</>;
}

function joined(people: readonly Person[]): ReactNode {
  return people.map((person, index) => (
    <span key={`${index}:${person.name}`}>
      {index > 0 ? (index === people.length - 1 ? " and " : ", ") : null}
      <Name person={person} />
    </span>
  ));
}

const schemaPerson = (person: Person) =>
  person.isSite
    ? { "@type": "Person", "@id": PERSON_ID, name: person.name }
    : {
        "@type": person.kind === "organization" ? "Organization" : "Person",
        name: person.name,
        ...(person.profileUrl ? { url: person.profileUrl } : {}),
      };

/** Markdown to the plain words a reader sees, for structured data. */
const plain = (markdown: string) =>
  markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`~#>]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * One Article, laid out like the pages Gomnee publishes to: the way back, what
 * it is and how long it takes, who wrote and checked it, the contents, the
 * body, and the people behind it. Each part appears only when the Article has
 * it. The private preview renders this same page without structured data.
 */
export function ArticlePage({
  slug,
  payload,
  publication,
  related,
  status,
  structuredData = true,
}: {
  slug: string;
  payload: ArticlePayload;
  /** null for a preview of an Article that isn't published yet. */
  publication: { publishedAt: string; updatedAt: string } | null;
  related: readonly ArticleSummary[];
  /** A line above the title, used by the private preview. */
  status?: ReactNode;
  structuredData?: boolean;
}) {
  const url = absoluteUrl(articlePath(slug));
  const outline = articleOutline(payload);
  const [category] = articleCategories(payload);
  const tags = articleTags(payload);
  const authors = authorsOf(payload);
  const reviewer = payload.contentFormat === "markdown" ? null : payload.presentation.reviewer;
  const verification = payload.contentFormat === "gomnee_article_v2" ? payload.verification : null;
  const faq = payload.contentFormat === "gomnee_article_v2" ? payload.faq : [];
  const hero = heroImage(payload);
  const described = [...authors, ...(reviewer ? [reviewer] : [])].filter((person) => person.description);
  const updated = publication && dayOf(publication.updatedAt) !== dayOf(publication.publishedAt);
  return (
    <>
      {structuredData && publication ? (
        <>
          <JsonLd
            data={{
              "@context": "https://schema.org",
              "@type": "BlogPosting",
              headline: payload.title,
              description: searchFields(payload).description,
              datePublished: publication.publishedAt,
              dateModified: publication.updatedAt,
              author: authors.map(schemaPerson),
              publisher: { "@type": "Person", "@id": PERSON_ID, name: SITE.name },
              mainEntityOfPage: url,
              url,
              inLanguage: SITE.language,
              image: hero ? hero.url : absoluteUrl("/opengraph-image"),
              ...(category ? { articleSection: category } : {}),
              ...(tags.length ? { keywords: tags.join(", ") } : {}),
              ...(outline.sources.entries.length ? { citation: outline.sources.entries.map((entry) => entry.url) } : {}),
            }}
          />
          <JsonLd
            data={{
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
                { "@type": "ListItem", position: 2, name: "Blog", item: absoluteUrl("/blog") },
                { "@type": "ListItem", position: 3, name: payload.title, item: url },
              ],
            }}
          />
          {faq.length ? (
            <JsonLd
              data={{
                "@context": "https://schema.org",
                "@type": "FAQPage",
                mainEntity: faq.map((entry) => ({
                  "@type": "Question",
                  name: entry.question,
                  acceptedAnswer: { "@type": "Answer", text: plain(entry.answerMarkdown) },
                })),
              }}
            />
          ) : null}
        </>
      ) : null}

      <nav className="crumbs" aria-label="Breadcrumb">
        <ol>
          <li>
            <Link href="/">Home</Link>
          </li>
          <li>
            <Link href="/blog">Blog</Link>
          </li>
          <li aria-current="page">{payload.title}</li>
        </ol>
      </nav>

      <article className="article">
        <header>
          {status}
          <p className="kicker">
            {category ? <span className="chip">{category}</span> : null}
            <span>{readingMinutes(payload)} min read</span>
          </p>
          <h1>{payload.title}</h1>
          <p className="deck">{payload.summary}</p>
          <div className="byline">
            <p>
              By {joined(authors)}
              {reviewer ? (
                <>
                  {" "}
                  · reviewed by <Name person={reviewer} />
                </>
              ) : null}
            </p>
            {publication ? (
              <p>
                Published <DateText iso={publication.publishedAt} />
                {updated ? (
                  <>
                    {" "}
                    · Updated <DateText iso={publication.updatedAt} />
                  </>
                ) : null}
              </p>
            ) : (
              <p>Preview · not published</p>
            )}
            {verification && verification.mode !== "not_applicable" ? (
              <a className="pill" href="#how-this-was-checked">
                {VERIFICATION_MODES[verification.mode]}
                {verification.lastVerifiedAt ? (
                  <>
                    {" "}
                    · <DateText iso={verification.lastVerifiedAt} />
                  </>
                ) : null}
              </a>
            ) : null}
          </div>
        </header>

        <ArticleBody
          payload={payload}
          outline={outline}
          contents={
            outline.contents.length >= 3 ? (
              <nav className="contents" aria-labelledby="contents-title">
                <p id="contents-title">In this article</p>
                <ol>
                  {outline.contents.map((entry) => (
                    <li key={entry.id}>
                      <a href={`#${entry.id}`}>{entry.label}</a>
                    </li>
                  ))}
                </ol>
              </nav>
            ) : null
          }
        />

        {described.length ? (
          <section className="people" aria-labelledby="about-the-authors">
            <h2 id="about-the-authors">{described.length === 1 ? "About the author" : "About the authors"}</h2>
            {described.map((person, index) => (
              <p key={`${index}:${person.name}`}>
                <b>
                  <Name person={person} />
                </b>{" "}
                {person.description}
              </p>
            ))}
          </section>
        ) : null}
      </article>

      {related.length ? (
        <aside className="related" aria-labelledby="related-title">
          <h2 id="related-title">Read next</h2>
          <ul>
            {related.map((other) => (
              <li key={other.slug}>
                <Link href={articlePath(other.slug)}>{other.title}</Link>
                <p>{other.summary}</p>
              </li>
            ))}
          </ul>
        </aside>
      ) : null}
    </>
  );
}
