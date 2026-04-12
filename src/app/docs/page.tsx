import DocsPageClient from "./DocsPageClient";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "Solana Token Scanner Documentation",
  description:
    "Learn how TokenSight AI evaluates Solana tokens with liquidity analysis, holder analysis, creator tracking, risk scoring, alerts, and portfolio tools.",
  path: "/docs",
  keywords: [
    "solana token scanner documentation",
    "solana token analysis guide",
    "solana rug checker guide",
    "solana liquidity analysis",
    "solana holder analysis",
  ],
});

export default function DocsPage() {
  return <DocsPageClient />;
}