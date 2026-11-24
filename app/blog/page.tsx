import Link from "next/link";
import { DateText } from "@/components/date";
import { PageJsonLd } from "@/components/json-ld";
import { listArticles } from "@/lib/articles";
import { pageMetadata } from "@/lib/metadata";

const description = "Every article, newest first.";

export const metadata = pageMetadata({ path: "/blog", title: "Blog", description });

export default function BlogIndex() {
  return (
    <>
      <PageJsonLd type="CollectionPage" path="/blog" name="Blog" description={description} />
      <h1>Blog</h1>
      <ul className="article-list">
        {listArticles().map((article) => (
          <li key={article.slug}>
            <Link href={`/blog/${article.slug}`}>{article.title}</Link>
            <p>{article.summary}</p>
            <DateText iso={article.published} />
          </li>
        ))}
      </ul>
    </>
  );
}
