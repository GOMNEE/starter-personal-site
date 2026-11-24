// Checks the built site the way Gomnee's onboarding and free audit look at
// it: every page answers, carries complete metadata and one main heading,
// structured data parses and matches, the sitemap lists every article.
// Run after a build: pnpm build && pnpm check
import { spawn } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";

const site = readFileSync("lib/site.ts", "utf8");
const field = (name) => site.match(new RegExp(`${name}:\\s*"([^"]*)"`))?.[1] ?? "";
const SITE_URL = field("url").replace(/\/$/, "");
const slugs = readdirSync("content/articles")
  .filter((file) => file.endsWith(".md"))
  .map((file) => file.replace(/\.md$/, ""));
const pages = ["/", "/about", "/blog", "/privacy", ...slugs.map((slug) => `/blog/${slug}`)];

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

await ready();
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
  if (path.startsWith("/blog/")) {
    const posts = data.filter((item) => item["@type"] === "BlogPosting");
    if (posts.length !== 1) fail(path, `${posts.length} BlogPosting blocks, not one`);
    else if (!posts[0].datePublished) fail(path, "BlogPosting has no datePublished");
  }
}

const sitemap = await (await fetch(`${base}/sitemap.xml`)).text();
for (const slug of slugs)
  if (!sitemap.includes(`<loc>${SITE_URL}/blog/${slug}</loc>`)) fail("/sitemap.xml", `doesn't list /blog/${slug}`);
const robots = await (await fetch(`${base}/robots.txt`)).text();
if (!/^Sitemap: \S+/m.test(robots)) fail("/robots.txt", "names no sitemap");
const missing = await fetch(`${base}/no-such-page-${port}`);
if (missing.status !== 404) fail("/no-such-page", `answered ${missing.status}, not 404`);
if (existsSync("app/llms.txt") && (await fetch(`${base}/llms.txt`)).status !== 200) fail("/llms.txt", "doesn't answer 200");

if (SITE_URL === "https://example.com") warnings.push("lib/site.ts: replace example.com with your address");
if (field("name") === "Your Name") warnings.push("lib/site.ts: replace Your Name");
if (field("email").endsWith("@example.com")) warnings.push("lib/site.ts: replace the example email");
if (slugs.includes("hello-world")) warnings.push("content/articles/hello-world.md: replace the placeholder article");

stop();
for (const warning of warnings) console.log(`warning  ${warning}`);
for (const failure of failures) console.log(`fail     ${failure}`);
console.log(failures.length ? `\n${failures.length} problems in ${pages.length} pages.` : `\nAll ${pages.length} pages pass.`);
process.exit(failures.length ? 1 : 0);
