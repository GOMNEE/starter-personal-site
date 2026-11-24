# Personal site starter

A personal site with a blog, built to run on [Gomnee](https://gomnee.com):
Next.js 16, Markdown articles, and what search engines and AI agents look for,
from the first commit.

## Start

1. Choose **Use this template** on GitHub to create your own repository.
2. Edit `lib/site.ts`: your address, your name, one sentence about the site,
   your email.
3. Replace the text on the home and about pages, and
   `content/articles/hello-world.md` with your first article.
4. Run it:

   ```sh
   pnpm install
   pnpm dev
   ```

5. Before you publish:

   ```sh
   pnpm build && pnpm check
   ```

Building with a coding agent? It reads `AGENTS.md`. For the full guidance,
give it the skill: https://gomnee.com/.well-known/agent-skills/gomnee-ready-site/SKILL.md

## What's inside

- Pages: home, about, the blog, each article, privacy and a real 404.
- On every page: title, description, one canonical address, Open Graph and a
  share image.
- Structured data: WebSite and Person on the home page, one BlogPosting per
  article.
- `sitemap.xml`, `robots.txt` and `llms.txt`.
- Articles as Markdown files, read through one module, `lib/articles.ts`.
- Nothing to run besides the site: no database, no environment variables.
- `pnpm check` tests the built site the way Gomnee looks at it, and GitHub
  runs it on every push.

## Run it on Gomnee

1. Connect this repository in Gomnee through its GitHub App, for this
   repository only. It reads your code and never changes it.
2. Preview an exact commit, and publish it when you're ready.
3. Point your domain at it with the DNS records Gomnee gives you.
4. Connect Search Console, read-only, and submit your sitemap.
5. Agree with Gomnee where your Articles are published. Until then, they're
   the Markdown files here.

Gomnee is invite-only, and hosting is switched on for each workspace:
https://gomnee.com

## Your choices

- `robots.txt` allows every crawler, AI crawlers included. Decide whether to
  block training crawlers or state Content Signals.
- `llms.txt` is optional: delete `app/llms.txt` if you don't want one.

Check your live site with Gomnee's free AI site audit:
https://app.gomnee.com/audit
