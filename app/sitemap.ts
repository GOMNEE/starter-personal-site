import type { MetadataRoute } from "next";
import { listArticles } from "@/lib/articles";
import { absoluteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const articles = listArticles();
  const latest = articles[0]?.updated;
  return [
    { url: absoluteUrl("/"), lastModified: latest },
    { url: absoluteUrl("/blog"), lastModified: latest },
    { url: absoluteUrl("/about") },
    ...articles.map((article) => ({
      url: absoluteUrl(`/blog/${article.slug}`),
      lastModified: article.updated,
    })),
  ];
}
