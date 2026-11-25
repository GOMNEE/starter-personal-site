import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticlePage } from "@/components/article-page";
import { PreviewNavigation } from "@/components/preview-navigation";
import { relatedArticles } from "@/lib/articles";
import { getArticlePreview } from "@/lib/publishing/preview";

// A private snapshot Gomnee shows while you review an Article. It is never
// listed, indexed or measured, and only Gomnee may frame it (next.config.ts).
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Private article preview",
  robots: { index: false, follow: false, noarchive: true },
  referrer: "no-referrer",
  openGraph: null,
  twitter: null,
  alternates: { canonical: null },
};

export default async function ArticlePreviewPage({ params }: { params: Promise<{ token: string }> }) {
  const preview = await getArticlePreview((await params).token);
  if (!preview) notFound();
  const { article } = preview;
  return (
    <>
      <PreviewNavigation />
      <ArticlePage
        slug={article.slug}
        payload={article}
        publication={
          preview.publishedAt && preview.publicationUpdatedAt
            ? { publishedAt: preview.publishedAt.toISOString(), updatedAt: preview.publicationUpdatedAt.toISOString() }
            : null
        }
        related={await relatedArticles({ slug: article.slug, payload: article })}
        structuredData={false}
        status={
          <p className="preview-status" role="status">
            Private preview · {preview.snapshotKind === "unsaved" ? "Unsaved changes" : "Saved draft"} · Not published
          </p>
        }
      />
    </>
  );
}
