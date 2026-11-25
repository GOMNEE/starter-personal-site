# Working in this repository

This is a personal site with a blog, built to run on Gomnee. Gomnee hosts it
from this repository and publishes approved Articles to it through the site's
own publishing API. Keep it that way.

- **Facts:** never invent clients, numbers, quotes or reviews. Leave a visible
  placeholder and tell the owner.
- **Identity** lives in `lib/site.ts`. Pages read it; don't hard-code the
  name or the address anywhere else.
- **Every page** gets its metadata from `pageMetadata()` in `lib/metadata.ts`
  (title, description, canonical, Open Graph) and has exactly one `h1`.
- **Articles come only from Gomnee.** Gomnee sends them to
  `app/api/integrations/gomnee/publishing/v1/`; `lib/publishing/` validates and
  stores them in Postgres (`db/`); pages read them only through
  `lib/articles.ts`. Never add hand-written article files or a second source.
  A published Article's slug is its address: it never changes.
- **The publishing contract** in `lib/publishing/` is Gomnee's Custom Website
  protocol, tested in `tests/`. Don't change its request and response shapes,
  digests, idempotency or version rules. When the article page changes what it
  shows, bump `TEMPLATE.version` in `lib/publishing/publish.ts`, so Gomnee
  refreshes the destination before its next preview.
- **The article page** (`components/article-page.tsx`,
  `components/article-body.tsx`) renders every part of Gomnee's Article only
  when the Article has it: Markdown, `gomnee_article_v1` and `gomnee_article_v2`
  with its typed modules.
- **Previews** at `/article-preview/{token}` are private, expiring, `noindex`,
  and framed only by Gomnee (`next.config.ts`). Never list, index or measure
  them.
- **Markdown** renders with `react-markdown`, `skipHtml` and
  `rehype-sanitize`. Never inject raw HTML.
- **Structured data:** WebSite and Person on the home page, one BlogPosting
  per article, built from the same facts the page shows.
- **Measurement:** calls to action the owner wants counted carry a short,
  stable `data-gomnee-cta` value. The `gomnee-measurement-exclude` tag in
  `app/layout.tsx` lists the private paths.
- **One service:** Postgres at `DATABASE_URL`. The schema is
  `db/schema.ts`; after changing it, run `pnpm db:generate` and commit the
  migration, which `pnpm build` applies. No worker, scheduled job or disk on
  the host. Name every environment variable in `.env.example`, on its own
  line with its mark: `# required:core` when the site can't run without it,
  `# optional:core` otherwise. Gomnee reads that file and asks the owner for
  each required value before it deploys; an unmarked line counts as
  required. Local values go in `.env.local`. Never commit secrets.
- **No catch-all routes**, and no middleware that intercepts paths the site
  doesn't own.
- **Before you hand over:** `pnpm test && pnpm build && pnpm check`. Tests
  need a Postgres database whose name ends in `_test` (`TEST_DATABASE_URL`).

Full guidance:
https://gomnee.com/.well-known/agent-skills/gomnee-ready-site/SKILL.md
