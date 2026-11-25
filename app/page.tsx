import Link from "next/link";
import { JsonLd, PERSON_ID, WEBSITE_ID } from "@/components/json-ld";
import { listArticles } from "@/lib/articles";
import { articlePath } from "@/lib/publishing/publish";
import { pageMetadata } from "@/lib/metadata";
import { SITE, absoluteUrl } from "@/lib/site";

export const metadata = pageMetadata({
  path: "/",
  title: `${SITE.name}: notes from the work`,
  description: SITE.description,
  absoluteTitle: true,
});
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const latest = (await listArticles()).slice(0, 3);
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "WebSite",
              "@id": WEBSITE_ID,
              url: SITE.url,
              name: SITE.name,
              inLanguage: SITE.language,
              publisher: { "@id": PERSON_ID },
            },
            {
              "@type": "Person",
              "@id": PERSON_ID,
              name: SITE.name,
              url: absoluteUrl("/about"),
            },
          ],
        }}
      />
      {/* Replace this heading and paragraph with what the site is about. */}
      <h1>Notes from the work.</h1>
      <p>{SITE.description}</p>
      {latest.length ? (
        <>
          <h2>Latest</h2>
          <ul>
            {latest.map((article) => (
              <li key={article.slug}>
                <Link href={articlePath(article.slug)}>{article.title}</Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <p>
        <a href={`mailto:${SITE.email}`} data-gomnee-cta="contact">
          Email me
        </a>
      </p>
    </>
  );
}
