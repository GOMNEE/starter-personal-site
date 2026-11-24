import { SITE, absoluteUrl } from "@/lib/site";

/** One JSON-LD block. "<" is escaped so content can never close the script. */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

/** The person behind the site, described once and referred to by @id. */
export const PERSON_ID = absoluteUrl("/#person");
export const WEBSITE_ID = absoluteUrl("/#website");

/** A page that belongs to the site: WebPage, AboutPage or CollectionPage. */
export function PageJsonLd({
  type,
  path,
  name,
  description,
}: {
  type: "WebPage" | "AboutPage" | "CollectionPage";
  path: string;
  name: string;
  description: string;
}) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": type,
        "@id": absoluteUrl(path),
        url: absoluteUrl(path),
        name,
        description,
        inLanguage: SITE.language,
        isPartOf: { "@id": WEBSITE_ID },
        ...(type === "AboutPage" ? { about: { "@id": PERSON_ID } } : {}),
      }}
    />
  );
}
