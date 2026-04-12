import AlertsPageClient from "./AlertsPageClient";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "Solana Token Price Alerts",
  description:
    "Create Solana token price and signal alerts for market moves, score changes, and trading opportunities.",
  path: "/alerts",
  keywords: [
    "solana token price alerts",
    "solana token alerts",
    "solana price alerts",
    "token signal alerts",
    "solana trading alerts",
  ],
});

export default function AlertsPage() {
  return <AlertsPageClient />;
}