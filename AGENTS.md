# Working in this repository

This is a personal site with a blog, built to run on Gomnee. Gomnee hosts it
from this repository and publishes approved Articles to it. Keep it that way.

- **Facts:** never invent clients, numbers, quotes or reviews. Leave a visible
  placeholder and tell the owner.
- **Identity** lives in `lib/site.ts`. Pages read it; don't hard-code the
  name or the address anywhere else.
- **Every page** gets its metadata from `pageMetadata()` in `lib/metadata.ts`
  (title, description, canonical, Open Graph) and has exactly one `h1`.
- **Articles** are Markdown files in `content/articles/`, read only through
  `lib/articles.ts`. A published article's file name is its address: never
  rename it.
- **Markdown** renders with `react-markdown` and `skipHtml`. Never inject raw
  HTML.
- **Structured data:** WebSite and Person on the home page, one BlogPosting
  per article, built from the same facts the page shows.
- **Measurement:** calls to action the owner wants counted carry a short,
  stable `data-gomnee-cta` value.
- **Nothing from the host** besides serving the site: no database, worker,
  scheduled job or disk on the host. Name every environment variable in
  `.env.example`; never commit secrets.
- **No catch-all routes**, and no middleware that intercepts paths the site
  doesn't own.
- **Before you hand over:** `pnpm build && pnpm check`.

Full guidance:
https://gomnee.com/.well-known/agent-skills/gomnee-ready-site/SKILL.md
