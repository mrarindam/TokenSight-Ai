import HomePageClient from "./HomePageClient";
import { brandIconLargePath, buildCanonicalUrl, buildPageMetadata, siteName, siteUrl } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "Solana Token Scanner & Rug Checker",
  description:
    "Scan any Solana token for rug risk, liquidity, holder concentration, creator behavior, and live market signals with AI-powered on-chain analysis.",
  path: "/",
});

const homeStructuredData = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteName,
    url: siteUrl,
    logo: buildCanonicalUrl(brandIconLargePath),
  },
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: siteName,
    applicationCategory: "FinanceApplication",
    operatingSystem: "Web",
    url: siteUrl,
    description:
      "AI-powered Solana token scanner and rug checker with liquidity analysis, holder tracking, creator behavior signals, alerts, and portfolio tools.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    featureList: [
      "Solana token scanner",
      "Solana rug checker",
      "Liquidity analysis",
      "Holder concentration analysis",
      "Creator behavior tracking",
      "Real-time token alerts",
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What is TokenSight AI?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "TokenSight AI is a Solana token scanner and rug checker that analyzes liquidity, holder distribution, creator behavior, trading activity, and on-chain signals to help traders evaluate token risk.",
        },
      },
      {
        "@type": "Question",
        name: "Can I scan any Solana token?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. TokenSight AI can scan any Solana token address and assemble market, holder, liquidity, and risk data into one report.",
        },
      },
      {
        "@type": "Question",
        name: "What does the Solana rug checker analyze?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "The rug checker reviews liquidity depth, holder concentration, creator behavior, verification signals, and trading momentum to surface potential token risk before you trade.",
        },
      },
    ],
  },
];

export default function HomePage() {
  return (
    <>
      {homeStructuredData.map((item) => (
        <script
          key={item["@type"]}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
      <HomePageClient />
    </>
  );
}
