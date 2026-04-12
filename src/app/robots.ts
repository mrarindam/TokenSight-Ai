import type { MetadataRoute } from "next";

import { buildCanonicalUrl, siteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/leaderboard",
          "/login",
          "/portfolio",
          "/profile",
          "/scan/history",
          "/settings/",
        ],
      },
    ],
    sitemap: buildCanonicalUrl("/sitemap.xml"),
    host: siteUrl,
  };
}