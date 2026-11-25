import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ArticlePage } from "@/components/article-page";
import { heroImage, articleTags, searchFields } from "@/lib/article-view";
import { getArticle, relatedArticles } from "@/lib/articles";
import { pageMetadata } from "@/lib/metadata";
import { articlePath } from "@/lib/publishing/publish";

type Props = { params: Promise<{ slug: string }> };

// Articles arrive from Gomnee at any time, so each request reads the database.
// An Article's address never changes once published.
export const dynamic = "force-dynamic";

const load = cache(getArticle);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const article = await load((await params).slug);
  if (!article) return {};
  const { payload } = article;
  const search = searchFields(payload);
  const hero = heroImage(payload);
  const authors =
    payload.contentFormat === "markdown" ? [] : payload.presentation.authors.map((author) => author.name);
  const tags = articleTags(payload);
  return pageMetadata({
    path: articlePath(article.slug),
    title: search.title,
    description: search.description,
    openGraph: {
      type: "article",
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
      ...(authors.length ? { authors } : {}),
      ...(hero ? { images: [{ url: hero.url, width: hero.width, height: hero.height, alt: hero.alt }] } : {}),
      ...(tags.length ? { tags: [...tags] } : {}),
    },
  });
}

export default async function Page({ params }: Props) {
  const article = await load((await params).slug);
  if (!article) notFound();
  return (
    <ArticlePage
      slug={article.slug}
      payload={article.payload}
      publication={{ publishedAt: article.publishedAt, updatedAt: article.updatedAt }}
      related={await relatedArticles(article)}
    />
  );
}
