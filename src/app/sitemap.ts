import type { MetadataRoute } from "next";

import { buildCanonicalUrl } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    {
      url: buildCanonicalUrl("/"),
      lastModified,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: buildCanonicalUrl("/scan"),
      lastModified,
      changeFrequency: "daily",
      priority: 0.95,
    },
    {
      url: buildCanonicalUrl("/docs"),
      lastModified,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: buildCanonicalUrl("/about"),
      lastModified,
      changeFrequency: "monthly",
      priority: 0.65,
    },
    {
      url: buildCanonicalUrl("/contact"),
      lastModified,
      changeFrequency: "monthly",
      priority: 0.65,
    },
    {
      url: buildCanonicalUrl("/privacy-policy"),
      lastModified,
      changeFrequency: "monthly",
      priority: 0.55,
    },
    {
      url: buildCanonicalUrl("/terms-of-service"),
      lastModified,
      changeFrequency: "monthly",
      priority: 0.55,
    },
    {
      url: buildCanonicalUrl("/alerts"),
      lastModified,
      changeFrequency: "weekly",
      priority: 0.7,
    },
  ];
}
