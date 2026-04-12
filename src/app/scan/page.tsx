import ScanPageClient from "./ScanPageClient";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "Scan Any Solana Token",
  description:
    "Run a live Solana token scan with AI scoring, rug check signals, liquidity analysis, holder breakdown, creator tracking, and market data.",
  path: "/scan",
  keywords: [
    "scan any solana token",
    "solana token scanner",
    "solana rug checker",
    "solana token analysis",
    "solana liquidity checker",
  ],
});

export default function ScanPage() {
  return <ScanPageClient />;
}