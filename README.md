# Personal site starter

A personal site with a blog that [Gomnee](https://gomnee.com) runs: Next.js 16,
the publishing API Gomnee sends Articles to, private previews for review, and
what search engines and AI agents look for, from the first commit.

## Start

1. Choose **Use this template** on GitHub to create your own repository.
2. Edit `lib/site.ts`: your address, your name, one sentence about the site,
   your email. Replace the text on the home and about pages.
3. Create a Postgres database. [Neon](https://neon.tech) is free to start, and
   on Vercel you can add it from the Marketplace. Copy its connection string.
4. Create the key Gomnee will publish with:

   ```sh
   openssl rand -hex 32
   ```

5. Copy `.env.example` to `.env.local` and fill in both, then run it:

   ```sh
   pnpm install
   pnpm dev
   ```

6. Before you publish:

   ```sh
   pnpm build && pnpm check
   ```

Building with a coding agent? It reads `AGENTS.md`. For the full guidance,
give it the skill: https://gomnee.com/.well-known/agent-skills/gomnee-ready-site/SKILL.md

## How Articles arrive

You don't write Article files. In Gomnee you plan, draft, review and approve;
Gomnee then sends the exact approved revision to this site, which stores it in
your database and serves it at `/blog/{slug}`. Your blog, sitemap and
`llms.txt` list it at once.

| Method | Path | What it does |
| --- | --- | --- |
| GET | `/api/integrations/gomnee/publishing/v1` | What the site can receive, after a database check |
| PUT | `/api/integrations/gomnee/publishing/v1/articles/{articleKey}` | Publishes or updates one Article, live |
| GET | `/api/integrations/gomnee/publishing/v1/articles/{articleKey}` | Reads it back exactly as stored |
| POST | `/api/integrations/gomnee/publishing/v1/previews` | A private preview for Gomnee's review screen |

Every request carries the key from step 4 as `Authorization: Bearer …`.

- **Formats:** Markdown, `gomnee_article_v1` (sections, authors, images,
  sources) and `gomnee_article_v2`, which adds a procedure, a comparison,
  questions, how it was checked, categories, tags and a listing-card cover.
- **Safe to retry:** each delivery carries a unique command and a content
  digest. A repeated command returns its first receipt; an update against an
  older version, a changed address or a reused command with other content is
  refused, and the page doesn't change.
- **Previews** render with this site's own article page, at a link that
  expires after 14 minutes, that only `https://app.gomnee.com` can show in a
  frame, and that is never listed, indexed or measured.
- **Taking an Article down:** set its `status` to `archived` in the
  `articles` table. Gomnee never deletes anything here.

## Settings

| Name | In `.env.example` | What it is |
| --- | --- | --- |
| `DATABASE_URL` | `# required:core` | Your Postgres connection string |
| `GOMNEE_PUBLISHING_TOKEN` | `# required:core` | The key from step 4 |
| `GOMNEE_PREVIEW_STAGING_ORIGINS` | `# optional:core` | Extra origins allowed to frame previews; leave empty unless Gomnee asks |

**On your computer,** the values live in `.env.local`, which Next.js loads and
Git ignores.

**On Gomnee,** nothing is copied from your computer. When you connect the
repository, Gomnee reads `.env.example` and lists every line marked
`# required:core` as a protected value it needs before it deploys. You enter
those values once, in the site's Preview step; Gomnee keeps them protected and
gives them to the site when it builds and runs. Lines marked
`# optional:core` are never asked for, and a line without a mark counts as
required, so mark every new setting you add.

Without the two required values the site still runs, with an empty blog, and
`pnpm check` says publishing isn't configured. `pnpm build` applies the
database migrations in `drizzle/` whenever `DATABASE_URL` is set.

## What's inside

- Pages: home, about, the blog, each article, privacy and a real 404.
- On every page: title, description, one canonical address, Open Graph and a
  share image.
- Article pages laid out like the ones Gomnee publishes to: breadcrumbs,
  category and reading time, byline and dates, contents, the opening,
  sections with their sources, steps, comparison tables, questions, how it was
  checked and the author box, each only when the Article has it.
- Structured data: WebSite and Person on the home page; BlogPosting,
  BreadcrumbList and, with questions, FAQPage on each article.
- `sitemap.xml`, `robots.txt` and `llms.txt`.
- Tests against a real Postgres (`pnpm test`), and `pnpm check`, which tests
  the built site the way Gomnee looks at it. GitHub runs both on every push;
  against its test database, `pnpm check` also publishes one Article and
  opens one preview through the site's own API.

## Run it on Gomnee

1. Connect this repository in Gomnee through its GitHub App, for this
   repository only. It reads your code and never changes it.
2. Gomnee reads `.env.example` and asks for `DATABASE_URL` and
   `GOMNEE_PUBLISHING_TOKEN` in the Preview step. Enter them there.
3. Preview an exact commit, and publish it when you're ready.
4. Point your domain at it with the DNS records Gomnee gives you.
5. Connect Search Console, read-only, and submit your sitemap.
6. In Gomnee, open **Integrations → CMS** and paste the same publishing key.
   Gomnee shows **Connected** once it has checked the site's capabilities.

Gomnee is invite-only, and hosting is switched on for each workspace:
https://gomnee.com

## Your choices

- `robots.txt` allows every crawler, AI crawlers included. Decide whether to
  block training crawlers or state Content Signals.
- `llms.txt` is optional: delete `app/llms.txt` if you don't want one.

Check your live site with Gomnee's free AI site audit:
https://app.gomnee.com/audit

## License

MIT. Use it for any site you like.
