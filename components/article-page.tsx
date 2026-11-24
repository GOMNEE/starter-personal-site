import Link from "next/link";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ReactNode } from "react";
import { DateText } from "@/components/date";
import { JsonLd, PERSON_ID } from "@/components/json-ld";
import { type Article, type Person, headingIds, headingText, relatedArticles } from "@/lib/articles";
import { SITE, absoluteUrl } from "@/lib/site";

/** Markdown only: raw HTML in content is dropped, never injected. */
function Body({ markdown, ids }: { markdown: string; ids?: readonly string[] }) {
  let next = 0;
  const components: Components = ids
    ? { h2: ({ children }) => <h2 id={ids[next++]}>{children}</h2> }
    : {};
  return (
    <Markdown remarkPlugins={[remarkGfm]} skipHtml components={components}>
      {markdown}
    </Markdown>
  );
}

function Name({ person }: { person: Person }) {
  return person.url ? <a href={person.url}>{person.name}</a> : <>{person.name}</>;
}

function joined(people: readonly Person[]): ReactNode {
  return people.map((person, index) => (
    <span key={person.name}>
      {index > 0 ? (index === people.length - 1 ? " and " : ", ") : null}
      <Name person={person} />
    </span>
  ));
}

const schemaPerson = (person: Person) => ({
  "@type": person.kind === "organization" ? "Organization" : "Person",
  name: person.name,
  ...(person.url ? { url: person.url } : {}),
});

/**
 * One Article, laid out like the article pages Gomnee publishes to: the path
 * back, what it is and how long it takes, who wrote and checked it, the
 * contents, the body, questions, sources and the people behind it. Each part
 * appears only when the Article has it.
 */
export function ArticlePage({ article }: { article: Article }) {
  const url = absoluteUrl(`/blog/${article.slug}`);
  const [category] = article.categories;
  const related = relatedArticles(article);
  const described = [...article.authors, ...(article.reviewer ? [article.reviewer] : [])].filter(
    (person) => person.description,
  );
  const ids = headingIds(
    article.body
      .split("\n")
      .map((line) => line.match(/^##\s+(.+?)\s*#*\s*$/)?.[1])
      .filter((heading): heading is string => Boolean(heading))
      .map(headingText),
  );
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: article.title,
          description: article.search.description ?? article.summary,
          datePublished: article.published,
          dateModified: article.updated,
          author: article.authors.map(schemaPerson),
          publisher: { "@type": "Person", "@id": PERSON_ID, name: SITE.name },
          mainEntityOfPage: url,
          url,
          inLanguage: SITE.language,
          ...(article.cover ? { image: absoluteUrl(article.cover.src) } : {}),
          ...(category ? { articleSection: category } : {}),
          ...(article.tags.length ? { keywords: article.tags.join(", ") } : {}),
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
            { "@type": "ListItem", position: 2, name: "Blog", item: absoluteUrl("/blog") },
            { "@type": "ListItem", position: 3, name: article.title, item: url },
          ],
        }}
      />
      {article.faq.length ? (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: article.faq.map((entry) => ({
              "@type": "Question",
              name: entry.question,
              acceptedAnswer: { "@type": "Answer", text: entry.answer },
            })),
          }}
        />
      ) : null}

      <nav className="crumbs" aria-label="Breadcrumb">
        <ol>
          <li>
            <Link href="/">Home</Link>
          </li>
          <li>
            <Link href="/blog">Blog</Link>
          </li>
          <li aria-current="page">{article.title}</li>
        </ol>
      </nav>

      <article className="article">
        <header>
          <p className="kicker">
            {category ? <span className="chip">{category}</span> : null}
            <span>{article.readingMinutes} min read</span>
          </p>
          <h1>{article.title}</h1>
          <p className="deck">{article.summary}</p>
          <div className="byline">
            <p>
              By {joined(article.authors)}
              {article.reviewer ? (
                <>
                  {" "}
                  · reviewed by <Name person={article.reviewer} />
                </>
              ) : null}
            </p>
            <p>
              Published <DateText iso={article.published} />
              {article.updated !== article.published ? (
                <>
                  {" "}
                  · Updated <DateText iso={article.updated} />
                </>
              ) : null}
            </p>
            {article.verification ? (
              <a className="pill" href="#how-this-was-checked">
                {article.verification.mode === "first_hand" ? "Tested first-hand" : "Based on documentation"}
                {article.verification.lastVerified ? (
                  <>
                    {" "}
                    · <DateText iso={article.verification.lastVerified} />
                  </>
                ) : null}
              </a>
            ) : null}
          </div>
        </header>

        {article.cover ? (
          <figure className="cover">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={article.cover.src}
              alt={article.cover.alt}
              width={article.cover.width}
              height={article.cover.height}
              fetchPriority="high"
            />
            {article.cover.caption || article.cover.credit ? (
              <figcaption>
                {article.cover.caption}
                {article.cover.caption && article.cover.credit ? " · " : null}
                {article.cover.credit}
              </figcaption>
            ) : null}
          </figure>
        ) : null}

        {article.sections.length >= 3 ? (
          <nav className="contents" aria-labelledby="contents-title">
            <p id="contents-title">In this article</p>
            <ol>
              {article.sections.map((section) => (
                <li key={section.id}>
                  <a href={`#${section.id}`}>{section.heading}</a>
                </li>
              ))}
            </ol>
          </nav>
        ) : null}

        <div className="body">
          <Body markdown={article.body} ids={ids} />
        </div>

        {article.faq.length ? (
          <section className="faq" aria-labelledby="questions">
            <h2 id="questions">Questions</h2>
            {article.faq.map((entry) => (
              <div key={entry.question}>
                <h3>{entry.question}</h3>
                <Body markdown={entry.answer} />
              </div>
            ))}
          </section>
        ) : null}

        {article.verification?.note ? (
          <section className="checked" aria-labelledby="how-this-was-checked">
            <h2 id="how-this-was-checked">How this was checked</h2>
            <Body markdown={article.verification.note} />
          </section>
        ) : null}

        {article.sources.length ? (
          <section className="sources" aria-labelledby="sources">
            <h2 id="sources">Sources</h2>
            <ol>
              {article.sources.map((source) => (
                <li key={source.url}>
                  <a href={source.url}>{source.label}</a>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {described.length ? (
          <section className="people" aria-labelledby="about-the-authors">
            <h2 id="about-the-authors">{described.length === 1 ? "About the author" : "About the authors"}</h2>
            {described.map((person) => (
              <p key={person.name}>
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
                <Link href={`/blog/${other.slug}`}>{other.title}</Link>
                <p>{other.summary}</p>
              </li>
            ))}
          </ul>
        </aside>
      ) : null}
    </>
  );
}
