import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { DateText } from "@/components/date";
import { JsonLd, PERSON_ID } from "@/components/json-ld";
import { getArticle, listArticles } from "@/lib/articles";
import { pageMetadata } from "@/lib/metadata";
import { SITE, absoluteUrl } from "@/lib/site";

type Props = { params: Promise<{ slug: string }> };

// An Article's address never changes once published: no other slugs exist.
export const dynamicParams = false;
export function generateStaticParams() {
  return listArticles().map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const article = getArticle((await params).slug);
  if (!article) return {};
  return pageMetadata({
    path: `/blog/${article.slug}`,
    title: article.title,
    description: article.description,
    openGraph: {
      type: "article",
      publishedTime: article.published,
      modifiedTime: article.updated,
      authors: [article.author],
    },
  });
}

export default async function ArticlePage({ params }: Props) {
  const article = getArticle((await params).slug);
  if (!article) notFound();
  const url = absoluteUrl(`/blog/${article.slug}`);
  return (
    <article>
      {/* One BlogPosting, from the same facts the page shows. */}
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: article.title,
          description: article.description,
          datePublished: article.published,
          dateModified: article.updated,
          author: { "@type": "Person", name: article.author, url: absoluteUrl("/about") },
          publisher: { "@type": "Person", "@id": PERSON_ID, name: SITE.name },
          mainEntityOfPage: url,
          url,
          inLanguage: SITE.language,
        }}
      />
      <h1>{article.title}</h1>
      <p className="byline">
        By {article.author} · <DateText iso={article.published} />
        {article.updated !== article.published && (
          <>
            {" "}
            · Updated <DateText iso={article.updated} />
          </>
        )}
      </p>
      {/* Markdown only: raw HTML in content is dropped, never injected. */}
      <Markdown remarkPlugins={[remarkGfm]} skipHtml>
        {article.body}
      </Markdown>
    </article>
  );
}
