import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Every client, crawlers and agents included, gets the title, canonical and
  // meta tags in the initial <head>, never streamed into the body.
  htmlLimitedBots: /.*/,
};

export default nextConfig;
