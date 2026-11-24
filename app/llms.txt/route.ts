import { listArticles } from "@/lib/articles";
import { SITE, absoluteUrl } from "@/lib/site";

// /llms.txt (llmstxt.org): what the site is, for AI tools, and where to read.
// Optional: delete this folder if you don't want one.
export const dynamic = "force-static";

export function GET() {
  const articles = listArticles();
  const text = [
    `# ${SITE.name}`,
    "",
    `> ${SITE.description}`,
    "",
    "## Pages",
    "",
    `- [About](${absoluteUrl("/about")}): who writes this site`,
    `- [Blog](${absoluteUrl("/blog")}): every article, newest first`,
    ...(articles.length
      ? ["", "## Articles", "", ...articles.map((article) => `- [${article.title}](${absoluteUrl(`/blog/${article.slug}`)}): ${article.description}`)]
      : []),
    "",
  ].join("\n");
  return new Response(text, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
