import Link from "next/link";
import { DateText } from "@/components/date";
import { PageJsonLd } from "@/components/json-ld";
import { listArticles } from "@/lib/articles";
import { pageMetadata } from "@/lib/metadata";
import { articlePath } from "@/lib/publishing/publish";

const description = "Every article, newest first.";

export const metadata = pageMetadata({ path: "/blog", title: "Blog", description });
export const dynamic = "force-dynamic";

export default async function BlogIndex() {
  const articles = await listArticles();
  return (
    <>
      <PageJsonLd type="CollectionPage" path="/blog" name="Blog" description={description} />
      <h1>Blog</h1>
      {articles.length ? (
        <ul className="article-list">
          {articles.map((article) => (
            <li key={article.slug}>
              {article.cover ? (
                // A listing card's artwork; it never appears in the article itself.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={article.cover.url}
                  alt={article.cover.alt}
                  width={article.cover.width}
                  height={article.cover.height}
                  loading="lazy"
                />
              ) : null}
              <Link href={articlePath(article.slug)}>{article.title}</Link>
              <p>{article.summary}</p>
              <DateText iso={article.publishedAt} />
            </li>
          ))}
        </ul>
      ) : (
        <p>No articles yet. They appear here as Gomnee publishes them.</p>
      )}
    </>
  );
}
