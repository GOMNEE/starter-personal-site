import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticlePage } from "@/components/article-page";
import { getArticle, listArticles } from "@/lib/articles";
import { pageMetadata } from "@/lib/metadata";

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
    title: article.search.title ?? article.title,
    description: article.search.description ?? article.summary,
    openGraph: {
      type: "article",
      publishedTime: article.published,
      modifiedTime: article.updated,
      authors: article.authors.map((author) => author.name),
      ...(article.cover
        ? { images: [{ url: article.cover.src, width: article.cover.width, height: article.cover.height, alt: article.cover.alt }] }
        : {}),
      ...(article.tags.length ? { tags: [...article.tags] } : {}),
    },
  });
}

export default async function Page({ params }: Props) {
  const article = getArticle((await params).slug);
  if (!article) notFound();
  return <ArticlePage article={article} />;
}
