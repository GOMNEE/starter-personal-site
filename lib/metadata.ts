import type { Metadata } from "next";
import { SITE } from "./site";

/** The share image app/opengraph-image.tsx draws, named on every page. */
const SHARE_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: SITE.description,
};

/**
 * A page's metadata, complete: title, description, its one canonical address,
 * and Open Graph with the same address, the site's name and the share image.
 * A page's own Open Graph replaces the layout's, so the image is named here.
 */
export function pageMetadata({
  path,
  title,
  description,
  absoluteTitle = false,
  openGraph = {},
}: {
  path: string;
  title: string;
  description: string;
  /** True when the title already names the site, so the template doesn't repeat it. */
  absoluteTitle?: boolean;
  openGraph?: Record<string, unknown>;
}): Metadata {
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      url: path,
      title,
      description,
      siteName: SITE.name,
      locale: SITE.language,
      images: [SHARE_IMAGE],
      ...openGraph,
    },
    twitter: { card: "summary_large_image" },
  };
}
