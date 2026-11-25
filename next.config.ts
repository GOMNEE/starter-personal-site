import type { NextConfig } from "next";

/**
 * Only Gomnee may frame a private Article preview: app.gomnee.com, plus any
 * HTTPS origins listed in GOMNEE_PREVIEW_STAGING_ORIGINS (Gomnee's own test
 * environments; leave it empty unless Gomnee asks).
 */
export function previewFrameAncestors(configured = process.env.GOMNEE_PREVIEW_STAGING_ORIGINS ?? "") {
  const origins = new Set(["https://app.gomnee.com"]);
  for (const value of configured.split(/[\s,]+/).filter(Boolean)) {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.hostname.includes("*") ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      throw new Error("GOMNEE_PREVIEW_STAGING_ORIGINS must contain HTTPS origins only.");
    origins.add(url.origin);
  }
  return `frame-ancestors ${[...origins].join(" ")};`;
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Every client, crawlers and agents included, gets the title, canonical and
  // meta tags in the initial <head>, never streamed into the body.
  htmlLimitedBots: /.*/,
  async headers() {
    const privateHeaders = [
      { key: "Cache-Control", value: "private, no-store" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
    ];
    return [
      {
        // Every page except the private preview refuses to be framed.
        source: "/((?!article-preview(?:/|$)).*)",
        headers: [{ key: "X-Frame-Options", value: "DENY" }],
      },
      {
        source: "/article-preview/:path*",
        headers: [...privateHeaders, { key: "Content-Security-Policy", value: previewFrameAncestors() }],
      },
      {
        source: "/api/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
