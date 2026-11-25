// Checks the built site the way Gomnee's onboarding and free audit look at it:
// every page answers, carries complete metadata and one main heading,
// structured data parses and matches, the sitemap lists every article, and
// the publishing destination answers.
//
// Against a test database (a name ending in _test, as in CI) it also publishes
// one Article and opens one private preview through the running site, the way
// Gomnee would. It never publishes to any other database.
//
// Run after a build: pnpm build && pnpm check
import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

const site = readFileSync("lib/site.ts", "utf8");
const field = (name) => site.match(new RegExp(`${name}:\\s*"([^"]*)"`))?.[1] ?? "";
const SITE_URL = field("url").replace(/\/$/, "");
const pages = ["/", "/about", "/blog", "/privacy"];

const failures = [];
const warnings = [];
const fail = (path, message) => failures.push(`${path}: ${message}`);

const port = 3900 + Math.floor(Math.random() * 90);
const base = `http://127.0.0.1:${port}`;
const server = spawn("node_modules/.bin/next", ["start", "-H", "127.0.0.1", "-p", String(port)], {
  stdio: "ignore",
});
const stop = () => server.kill();
process.on("exit", stop);

async function ready() {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      if ((await fetch(base)).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("The site didn't start. Run pnpm build first.");
}

const all = (html, pattern) => [...html.matchAll(pattern)].map((match) => match[1]);
const meta = (html, attribute, name) =>
  html.match(new RegExp(`<meta ${attribute}="${name}" content="([^"]*)"`))?.[1];
const strip = (url) => (url ?? "").replace(/\/$/, "");

// Gomnee's canonical JSON and digest (lib/publishing/publish.ts), for the sample request.
function canonicalJson(value) {
  if (value === null) return "null";
  if (typeof value === "string")
    return JSON.stringify(value).replaceAll("<", "\\u003c").replaceAll(">", "\\u003e").replaceAll("&", "\\u0026");
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${canonicalJson(key)}:${canonicalJson(value[key])}`)
    .join(",")}}`;
}
const digest = (value) => `sha256:${createHash("sha256").update(canonicalJson(value), "utf8").digest("hex")}`;

await ready();

// ---------- the publishing destination ----------
const API = `${base}/api/integrations/gomnee/publishing/v1`;
const token = process.env.GOMNEE_PUBLISHING_TOKEN;
const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };
const capabilities = await fetch(API, { headers });
let published = [];
if (capabilities.status === 503) {
  warnings.push("publishing is not configured: set DATABASE_URL and GOMNEE_PUBLISHING_TOKEN to receive Articles from Gomnee");
} else if (capabilities.status !== 200) {
  fail(API, `answered ${capabilities.status}, not 200`);
} else {
  const declared = await capabilities.json();
  if (declared.siteOrigin !== new URL(SITE_URL).origin)
    fail(API, `declares ${declared.siteOrigin}, not ${new URL(SITE_URL).origin}`);
  const testDatabase = new URL(process.env.DATABASE_URL ?? "postgres://x/").pathname.endsWith("_test");
  if (testDatabase) {
    const article = {
      slug: `check-${Date.now()}`,
      title: "A check from pnpm check",
      summary: "Published through the site's own API, the way Gomnee publishes.",
      contentFormat: "markdown",
      content: "## What this checks\n\nThat an Article Gomnee sends becomes a page.",
    };
    const articleKey = randomUUID();
    const put = await fetch(`${API}/articles/${articleKey}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        schemaVersion: "gomnee_live_article_publish_v1",
        commandId: randomUUID(),
        articleRevisionId: randomUUID(),
        expectedRemoteVersion: null,
        contentDigest: digest(article),
        article,
      }),
    });
    if (put.status !== 200) fail(`${API}/articles`, `publishing answered ${put.status}, not 200`);
    else {
      published = [article.slug];
      pages.push(`/blog/${article.slug}`);
      const back = await fetch(`${API}/articles/${articleKey}`, { headers });
      if ((await back.json()).contentDigest !== digest(article)) fail(`${API}/articles`, "read-back digest differs");
    }
    const preview = await fetch(`${API}/previews`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        schemaVersion: "gomnee_article_preview_request_v1",
        articleKey,
        sourceRevisionId: randomUUID(),
        snapshotKind: "saved",
        contentDigest: digest(article),
        template: declared.template,
        article,
      }),
    });
    if (preview.status !== 201) fail(`${API}/previews`, `answered ${preview.status}, not 201`);
    else {
      const { previewUrl } = await preview.json();
      const page = await fetch(base + new URL(previewUrl).pathname);
      if (page.status !== 200) fail("/article-preview", `answered ${page.status}, not 200`);
      if (!page.headers.get("x-robots-tag")?.includes("noindex")) fail("/article-preview", "is not noindex");
      if (!page.headers.get("content-security-policy")?.includes("frame-ancestors https://app.gomnee.com"))
        fail("/article-preview", "Gomnee cannot frame it");
    }
  }
}

// ---------- every page ----------
for (const path of pages) {
  const response = await fetch(base + path);
  if (response.status !== 200) {
    fail(path, `answered ${response.status}, not 200`);
    continue;
  }
  const html = await response.text();
  const head = html.slice(0, html.indexOf("</head>"));
  const canonical = head.match(/<link rel="canonical" href="([^"]*)"/)?.[1];
  if (!/<title>[^<]+<\/title>/.test(head)) fail(path, "no <title> in the head");
  if (!meta(head, "name", "description")) fail(path, "no meta description in the head");
  if (strip(canonical) !== strip(SITE_URL + path)) fail(path, `canonical is ${canonical ?? "missing"}, not ${SITE_URL}${path}`);
  if (!/<html[^>]* lang="[^"]+"/.test(html)) fail(path, "no lang on <html>");
  if (!meta(head, "name", "gomnee-measurement-exclude")) fail(path, "no gomnee-measurement-exclude tag");
  const h1 = (html.match(/<h1[\s>]/g) ?? []).length;
  if (h1 !== 1) fail(path, `${h1} h1 headings, not one`);
  for (const property of ["og:title", "og:type", "og:url", "og:site_name", "og:image"])
    if (!meta(head, "property", property)) fail(path, `no ${property}`);
  if (strip(meta(head, "property", "og:url")) !== strip(canonical)) fail(path, "og:url differs from the canonical");
  const blocks = all(html, /<script type="application\/ld\+json">(.*?)<\/script>/gs);
  const data = [];
  for (const block of blocks) {
    try {
      data.push(JSON.parse(block));
    } catch {
      fail(path, "a JSON-LD block doesn't parse");
    }
  }
  if (!data.length) fail(path, "no structured data");
  const description = meta(head, "name", "description") ?? "";
  if (description.length > 160) warnings.push(`${path}: the meta description runs past 160 characters`);
  if (path.startsWith("/blog/")) {
    const posts = data.filter((item) => item["@type"] === "BlogPosting");
    if (posts.length !== 1) fail(path, `${posts.length} BlogPosting blocks, not one`);
    else if (!posts[0].datePublished) fail(path, "BlogPosting has no datePublished");
    if (data.filter((item) => item["@type"] === "BreadcrumbList").length !== 1)
      fail(path, "no BreadcrumbList for its breadcrumbs");
    const visible = html
      .replace(/<script[\s\S]*?<\/script>/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&#x27;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&");
    for (const faq of data.filter((item) => item["@type"] === "FAQPage"))
      for (const question of faq.mainEntity ?? [])
        if (!visible.includes(question.name)) fail(path, `FAQ question not shown on the page: ${question.name}`);
  }
}

const sitemap = await (await fetch(`${base}/sitemap.xml`)).text();
for (const slug of published)
  if (!sitemap.includes(`<loc>${SITE_URL}/blog/${slug}</loc>`)) fail("/sitemap.xml", `doesn't list /blog/${slug}`);
const robots = await (await fetch(`${base}/robots.txt`)).text();
if (!/^Sitemap: \S+/m.test(robots)) fail("/robots.txt", "names no sitemap");
const missing = await fetch(`${base}/no-such-page-${port}`);
if (missing.status !== 404) fail("/no-such-page", `answered ${missing.status}, not 404`);
if (existsSync("app/llms.txt") && (await fetch(`${base}/llms.txt`)).status !== 200) fail("/llms.txt", "doesn't answer 200");

// Gomnee reads .env.example the same way: an unmarked setting counts as required.
for (const line of readFileSync(".env.example", "utf8").split(/\r?\n/)) {
  const name = line.match(/^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=/)?.[1];
  if (name && name !== "NODE_ENV" && !/#\s*(required|optional):[A-Za-z0-9_-]+/i.test(line))
    warnings.push(`.env.example: mark ${name} "# required:core" or "# optional:core"; Gomnee treats it as required`);
}

if (SITE_URL === "https://example.com") warnings.push("lib/site.ts: replace example.com with your address");
if (field("name") === "Your Name") warnings.push("lib/site.ts: replace Your Name");
if (field("email").endsWith("@example.com")) warnings.push("lib/site.ts: replace the example email");

stop();
for (const warning of warnings) console.log(`warning  ${warning}`);
for (const failure of failures) console.log(`fail     ${failure}`);
console.log(failures.length ? `\n${failures.length} problems in ${pages.length} pages.` : `\nAll ${pages.length} pages pass.`);
process.exit(failures.length ? 1 : 0);
