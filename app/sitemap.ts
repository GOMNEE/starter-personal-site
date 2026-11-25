import type { MetadataRoute } from "next";
import { listArticles } from "@/lib/articles";
import { articlePath } from "@/lib/publishing/publish";
import { absoluteUrl } from "@/lib/site";

// Lists each Article as soon as Gomnee publishes it.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const articles = await listArticles();
  const latest = articles[0]?.updatedAt;
  return [
    { url: absoluteUrl("/"), lastModified: latest },
    { url: absoluteUrl("/blog"), lastModified: latest },
    { url: absoluteUrl("/about") },
    ...articles.map((article) => ({
      url: absoluteUrl(articlePath(article.slug)),
      lastModified: article.updatedAt,
    })),
  ];
}
