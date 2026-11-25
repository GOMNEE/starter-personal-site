import { listArticles } from "@/lib/articles";
import { articlePath } from "@/lib/publishing/publish";
import { SITE, absoluteUrl } from "@/lib/site";

// /llms.txt (llmstxt.org): what the site is, for AI tools, and where to read.
// Optional: delete this folder if you don't want one.
export const dynamic = "force-dynamic";

export async function GET() {
  const articles = await listArticles();
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
      ? ["", "## Articles", "", ...articles.map((article) => `- [${article.title}](${absoluteUrl(articlePath(article.slug))}): ${article.summary}`)]
      : []),
    "",
  ].join("\n");
  return new Response(text, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
