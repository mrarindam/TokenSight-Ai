import type { Metadata } from "next";

export const siteName = "TokenSight AI";
export const siteUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://tokensightai.tech";
export const brandIconPath = "/icons/android-chrome-192x192.png";
export const brandIconLargePath = "/icons/android-chrome-512x512.png";
export const brandAppleIconPath = "/icons/apple-touch-icon.png";
export const brandFaviconPath = "/icons/favicon.ico";
export const brandFavicon32Path = "/icons/favicon-32x32.png";
export const brandFavicon16Path = "/icons/favicon-16x16.png";
export const brandManifestPath = "/icons/site.webmanifest";

export const defaultTitle = "Solana Token Scanner & Rug Checker | TokenSight AI";
export const defaultDescription =
  "Scan any Solana token for rug risk, liquidity, holder concentration, creator behavior and live market signals with AI-powered on-chain analysis.";

export const defaultKeywords = [
  "solana token scanner",
  "solana rug checker",
  "solana token analysis",
  "solana token risk checker",
  "solana liquidity checker",
  "solana holder analysis",
  "ai solana token scanner",
  "scan solana token",
];

export function buildCanonicalUrl(path: string = "/") {
  return new URL(path, siteUrl).toString();
}

type MetadataInput = {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
};

export function buildPageMetadata({
  title,
  description,
  path,
  keywords = defaultKeywords,
}: MetadataInput): Metadata {
  const fullTitle = `${title} | ${siteName}`;

  return {
    title,
    description,
    keywords,
    alternates: {
      canonical: path,
    },
    openGraph: {
      title: fullTitle,
      description,
      url: buildCanonicalUrl(path),
      siteName,
      locale: "en_US",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
    },
  };
}
