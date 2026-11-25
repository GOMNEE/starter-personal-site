import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/lib/site";
import "./globals.css";

/**
 * Paths Gomnee's hosted-site measurement never counts: private previews and
 * the API. Each covers that path and everything below it.
 */
const UNMEASURED = ["/article-preview", "/api"].join(",");

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: SITE.name, template: `%s · ${SITE.name}` },
  description: SITE.description,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={SITE.language}>
      <head>
        {/* Stays mounted with the layout, so the tag is present on every page. */}
        <meta name="gomnee-measurement-exclude" content={UNMEASURED} />
      </head>
      <body>
        <header className="site-header">
          <Link href="/">{SITE.name}</Link>
          <nav aria-label="Main">
            <Link href="/blog">Blog</Link>
            <Link href="/about">About</Link>
          </nav>
        </header>
        <main>{children}</main>
        <footer className="site-footer">
          <Link href="/privacy">Privacy</Link>
        </footer>
      </body>
    </html>
  );
}
