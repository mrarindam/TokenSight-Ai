import Link from "next/link";
import { OfficialPageShell } from "@/components/site/OfficialPageShell";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "About TokenSight AI",
  description:
    "Learn what TokenSight AI is, who it is built for, and how the platform helps traders research Solana tokens with more confidence.",
  path: "/about",
  keywords: [
    "about tokensight ai",
    "solana token research platform",
    "solana risk analysis tool",
    "tokensight company page",
  ],
});

export default function AboutPage() {
  return (
    <OfficialPageShell
      badge="About TokenSight AI"
      title="A clearer intelligence layer for Solana token research."
      description="TokenSight AI is built to make token evaluation faster, more readable, and more actionable by combining live market data, on-chain signals, risk framing, and workflow tools inside one product."
      updatedOn="April 14, 2026"
      highlights={[
        "What TokenSight AI does and who it is built for.",
        "The product direction behind scans, alerts, and portfolio tools.",
        "How the platform turns fragmented token data into usable context.",
      ]}
    >
      <h2>What TokenSight AI is</h2>
      <p>
        TokenSight AI is a Solana-focused intelligence platform that helps traders and researchers evaluate tokens through one connected workflow. Instead of switching between multiple tabs for liquidity, holders, volume, historical scans, and alerts, the platform brings those signals together into a single experience.
      </p>

      <h2>What the platform is designed to solve</h2>
      <p>
        Early-stage token research is usually noisy. Important context is scattered across dashboards, explorers, charts, and social feeds, which makes it easy to miss risk signals or waste time validating the same data repeatedly. TokenSight AI is designed to reduce that friction and present the most important information in a form that is faster to interpret.
      </p>

      <h2>Core product areas</h2>
      <ul>
        <li>Token scans that summarize liquidity, holder concentration, creator behavior, and market context.</li>
        <li>Alerts that help users monitor price and signal movement without constant manual checking.</li>
        <li>Portfolio and history views that keep research organized across repeated sessions.</li>
        <li>Documentation and product guidance that make the workflow easier to understand for new users.</li>
      </ul>

      <h2>How we think about product quality</h2>
      <p>
        The goal is not to overload users with raw numbers. The goal is to make research more usable. That means clear scoring, readable summaries, quick follow-up actions, and a product surface that helps users decide what deserves deeper investigation.
      </p>

      <h2>Built by</h2>
      <p>
        TokenSight AI is built by <strong className="text-foreground">Arindam</strong>. You can connect through the{" "}
        <Link href="/contact" className="text-primary hover:underline">contact page</Link> or view more work on the{" "}
        <Link href="https://mrarindam.vercel.app/" target="_blank" rel="noreferrer" className="text-primary hover:underline">
          portfolio website
        </Link>
        .
      </p>

      <h2>Using TokenSight AI</h2>
      <p>
        TokenSight AI provides research and workflow support, not financial advice. Users should always make independent decisions, verify key details, and understand the risks of trading volatile or newly launched digital assets.
      </p>

      <p>
        For a deeper product walkthrough, visit the <Link href="/docs" className="text-primary hover:underline">documentation page</Link>.
      </p>
    </OfficialPageShell>
  );
}
