/**
 * The site's identity, in one place. Every page, the sitemap, the share image
 * and the structured data read it. Replace each value with your own before you
 * publish: `pnpm check` warns while any placeholder is left.
 */
export const SITE = {
  /** The one public address: https, and the host you chose (with or without www). */
  url: "https://example.com",
  /** You, as Articles name their author. A person or an organization, never a model. */
  name: "Your Name",
  /** One sentence about the site, under 160 characters. */
  description:
    "Your Name writes about the work they know best: what worked, what didn't, and why.",
  /** The language of the site, as a BCP 47 code. */
  language: "en",
  email: "you@example.com",
} as const;

/** An absolute URL on the site's one public address. */
export const absoluteUrl = (path: string) => new URL(path, SITE.url).toString();
