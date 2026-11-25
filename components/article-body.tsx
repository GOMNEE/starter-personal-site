import type { ReactNode } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { DateText } from "@/components/date";
import {
  ANCHORS,
  articleLink,
  articleOutline,
  rowSourceRefs,
  sourceRefs,
  type ArticleOutline,
  type SourceEntry,
  type SourceIndex,
} from "@/lib/article-view";
import type { ArticlePayload, RichArticlePayload, TypedArticlePayload } from "@/lib/publishing/contract";

/** Links on this site stay in the app; other sites are ordinary links. */
function ContentLink({ href, children }: { href?: string; children?: ReactNode }) {
  const link = articleLink(href);
  if (link.kind === "internal") return <Link href={link.href}>{children}</Link>;
  return <a href={link.href}>{children}</a>;
}

/** Markdown only: raw HTML in content is skipped and the result sanitized. */
export function Markdown({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeSanitize]}
      skipHtml
      components={{ a: ({ href, children }) => <ContentLink href={href}>{children}</ContentLink> }}
    >
      {text}
    </ReactMarkdown>
  );
}

/** Numbered links to the Article's one source list. */
function SourceRefs({ entries, label = "Sources" }: { entries: SourceEntry[]; label?: string }) {
  if (!entries.length) return null;
  return (
    <p className="article-refs">
      {label}:{" "}
      {entries.map((entry) => (
        <a key={entry.anchor} href={`#${entry.anchor}`} aria-label={`Source ${entry.number}: ${entry.label}`}>
          [{entry.number}]
        </a>
      ))}
    </p>
  );
}

function Note({ label, tone = "neutral", children }: { label: string; tone?: "neutral" | "success" | "warning"; children: ReactNode }) {
  return (
    <div className={`article-note article-note-${tone}`}>
      <p className="article-note-label">{label}</p>
      {children}
    </div>
  );
}

export const VERIFICATION_MODES = {
  first_hand: "Tested first-hand",
  docs_only: "Based on documentation",
  not_applicable: "Not applicable",
} as const;

type Procedure = NonNullable<TypedArticlePayload["procedure"]>;
function ProcedureBlock({ procedure, sources }: { procedure: Procedure; sources: SourceIndex }) {
  return (
    <div id={ANCHORS.procedure}>
      {procedure.prerequisitesMarkdown && (
        <Note label="Before you start">
          <Markdown text={procedure.prerequisitesMarkdown} />
        </Note>
      )}
      <ol className="article-steps">
        {procedure.steps.map((step) => (
          <li key={step.key} id={`step-${step.key}`}>
            <h3>{step.name}</h3>
            <Markdown text={step.instructionsMarkdown} />
            {step.expectedResultMarkdown && (
              <Note label="Expected result" tone="success">
                <Markdown text={step.expectedResultMarkdown} />
              </Note>
            )}
            <SourceRefs entries={sourceRefs(sources, step.citationKeys)} />
          </li>
        ))}
      </ol>
      {procedure.verificationMarkdown && (
        <>
          <h3>How to check the result</h3>
          <Markdown text={procedure.verificationMarkdown} />
        </>
      )}
      {procedure.troubleshootingMarkdown && (
        <Note label="If something doesn't work" tone="warning">
          <Markdown text={procedure.troubleshootingMarkdown} />
        </Note>
      )}
    </div>
  );
}

type Comparison = NonNullable<TypedArticlePayload["comparison"]>;
function ComparisonBlock({ comparison, caption, sources }: { comparison: Comparison; caption: string; sources: SourceIndex }) {
  return (
    <div id={ANCHORS.comparison}>
      <Note label="How this comparison works">
        <Markdown text={comparison.methodMarkdown} />
      </Note>
      {/* Focusable so a keyboard can scroll a wide table. */}
      <div className="article-table" role="region" aria-label={caption} tabIndex={0}>
        <table>
          <caption className="visually-hidden">{caption}</caption>
          <thead>
            <tr>
              <th scope="col">Item</th>
              {comparison.columns.map((column) => (
                <th key={column.key} scope="col">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {comparison.rows.map((row) => (
              <tr key={row.key}>
                <th scope="row">{row.label}</th>
                {comparison.columns.map((column, index) => {
                  const cell = row.cells.find((item) => item.columnKey === column.key)!;
                  return (
                    <td key={column.key}>
                      <Markdown text={cell.markdown} />
                      {index === comparison.columns.length - 1 && (
                        <SourceRefs entries={rowSourceRefs(sources, row.cells)} label="Sources for this row" />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {comparison.limitationsMarkdown && (
        <Note label="Limits of this comparison">
          <Markdown text={comparison.limitationsMarkdown} />
        </Note>
      )}
    </div>
  );
}

function Questions({ faq, sources }: { faq: TypedArticlePayload["faq"]; sources: SourceIndex }) {
  if (!faq.length) return null;
  return (
    <div className="article-faq">
      {faq.map((item) => (
        <div key={item.key}>
          <h3 id={`question-${item.key}`}>{item.question}</h3>
          <Markdown text={item.answerMarkdown} />
          <SourceRefs entries={sourceRefs(sources, item.citationKeys)} />
        </div>
      ))}
    </div>
  );
}

type Excerpt = NonNullable<NonNullable<TypedArticlePayload["verification"]>["excerpts"]>[number];
function ExcerptBlock({ excerpt, media }: { excerpt: Excerpt; media: RichArticlePayload["presentation"]["media"] }) {
  if (excerpt.kind === "screenshot") {
    const image = media.find((item) => item.key === excerpt.mediaKey)!;
    return (
      <p id={`excerpt-${excerpt.key}`} className="article-shot">
        Screenshot taken <DateText iso={excerpt.capturedAt} />:{" "}
        <a href={`#image-${image.key}`}>{image.caption ?? image.alt}</a>.
      </p>
    );
  }
  const measurement = excerpt.kind === "measurement";
  // Captured text is literal: React escapes it, so it is never read as Markdown or HTML.
  return (
    <figure id={`excerpt-${excerpt.key}`} className="article-excerpt">
      <figcaption>
        <strong>{measurement ? "Measurement" : "Output"}</strong> captured <DateText iso={excerpt.capturedAt} />
      </figcaption>
      {excerpt.command &&
        (measurement ? (
          <p className="article-excerpt-method">Method: {excerpt.command}</p>
        ) : (
          <pre aria-label="Command">
            <code>{excerpt.command}</code>
          </pre>
        ))}
      <pre>
        <code>{excerpt.content}</code>
      </pre>
    </figure>
  );
}

type Media = RichArticlePayload["presentation"]["media"];
function Figures({ items }: { items: Media }) {
  return items.map((item) => (
    <figure className="article-figure" key={item.key} id={`image-${item.key}`}>
      {/* Public images load directly from their own address; nothing here fetches them. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.url}
        alt={item.alt}
        width={item.width}
        height={item.height}
        loading={item.role === "hero" ? "eager" : "lazy"}
      />
      {(item.caption || item.credit) && (
        <figcaption>
          {item.caption}
          {item.caption && item.credit ? " · " : null}
          {item.credit}
        </figcaption>
      )}
    </figure>
  ));
}

/**
 * The Article's body, each part only when the Article has it: the opening, the
 * hero image, the sections with their procedure, comparison, questions,
 * evidence, images and sources, then general questions, the one numbered
 * source list, how it was checked, and its categories and tags.
 */
export function ArticleBody({
  payload,
  outline = articleOutline(payload),
  contents,
}: {
  payload: ArticlePayload;
  outline?: ArticleOutline;
  /** Placed before the first section. */
  contents?: ReactNode;
}) {
  if (payload.contentFormat === "markdown")
    return (
      <div className="body">
        <Markdown text={payload.content} />
      </div>
    );
  const typed = payload.contentFormat === "gomnee_article_v2" ? payload : null;
  const { anchors, sources } = outline;
  const media = payload.presentation.media;
  const generalFaq = typed?.faq.filter((item) => item.sectionKey === null) ?? [];
  const verification = typed?.verification;
  const excerpts = verification?.excerpts ?? [];
  const taxonomy = typed?.taxonomy;
  return (
    <div className="body">
      {payload.presentation.opening && (
        <div className="article-brief">
          <p className="article-note-label">In short</p>
          <Markdown text={payload.presentation.opening} />
        </div>
      )}
      <Figures items={media.filter((item) => item.role === "hero")} />
      {contents}
      {payload.sections.map((section) => (
        <section key={section.key} id={anchors.get(section.key)}>
          <h2>{section.heading}</h2>
          <Markdown text={section.markdown} />
          {typed?.procedure?.sectionKey === section.key && <ProcedureBlock procedure={typed.procedure} sources={sources} />}
          {typed?.comparison?.sectionKey === section.key && (
            <ComparisonBlock comparison={typed.comparison} caption={section.heading} sources={sources} />
          )}
          {typed && <Questions faq={typed.faq.filter((item) => item.sectionKey === section.key)} sources={sources} />}
          {excerpts
            .filter((excerpt) => excerpt.sectionKey === section.key)
            .map((excerpt) => (
              <ExcerptBlock key={excerpt.key} excerpt={excerpt} media={media} />
            ))}
          <Figures items={media.filter((item) => item.sectionKey === section.key)} />
          <SourceRefs entries={sources.bySection.get(section.key) ?? []} label="Sources for this section" />
        </section>
      ))}
      {generalFaq.length ? (
        <section id={ANCHORS.questions}>
          <h2>Questions</h2>
          <Questions faq={generalFaq} sources={sources} />
        </section>
      ) : null}
      {sources.entries.length > 0 && (
        <section id={ANCHORS.sources} aria-labelledby="sources-title">
          <h2 id="sources-title">Sources</h2>
          <ol className="article-sources">
            {sources.entries.map((entry) => (
              <li key={entry.anchor} id={entry.anchor}>
                <ContentLink href={entry.url}>{entry.label}</ContentLink>
                {entry.locators.length > 0 && <span> · {entry.locators.join("; ")}</span>}
              </li>
            ))}
          </ol>
        </section>
      )}
      {verification && (
        <section id={ANCHORS.verification} aria-labelledby="checked-title" className="article-checked">
          <h2 id="checked-title">How this was checked</h2>
          <dl className="article-facts">
            <div>
              <dt>Kind of check</dt>
              <dd>{VERIFICATION_MODES[verification.mode]}</dd>
            </div>
            {verification.lastVerifiedAt && (
              <div>
                <dt>Last checked</dt>
                <dd>
                  <DateText iso={verification.lastVerifiedAt} />
                </dd>
              </div>
            )}
            {verification.versions.length > 0 && (
              <div>
                <dt>Versions checked</dt>
                <dd>{verification.versions.map((item) => `${item.name} ${item.version}`).join(", ")}</dd>
              </div>
            )}
            {excerpts.length > 0 && (
              <div>
                <dt>Evidence in the text</dt>
                <dd>
                  <a href={`#excerpt-${excerpts[0]!.key}`}>
                    {excerpts.length === 1 ? "1 excerpt" : `${excerpts.length} excerpts`}
                  </a>
                </dd>
              </div>
            )}
          </dl>
          {verification.disclosure && <p>{verification.disclosure}</p>}
        </section>
      )}
      {taxonomy && (taxonomy.categories.length > 0 || taxonomy.tags.length > 0) && (
        <dl className="article-taxonomy">
          {taxonomy.categories.length > 0 && (
            <div>
              <dt>{taxonomy.categories.length === 1 ? "Category" : "Categories"}</dt>
              <dd>{taxonomy.categories.join(", ")}</dd>
            </div>
          )}
          {taxonomy.tags.length > 0 && (
            <div>
              <dt>Tags</dt>
              <dd>{taxonomy.tags.join(", ")}</dd>
            </div>
          )}
        </dl>
      )}
    </div>
  );
}
