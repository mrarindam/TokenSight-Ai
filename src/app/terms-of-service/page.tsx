import Link from "next/link";
import { OfficialPageShell } from "@/components/site/OfficialPageShell";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "Terms of Service",
  description:
    "Review the core terms that govern access to TokenSight AI, acceptable platform use, and service limitations.",
  path: "/terms-of-service",
  keywords: [
    "tokensight ai terms",
    "crypto platform terms of service",
    "solana analytics app terms",
  ],
});

export default function TermsOfServicePage() {
  return (
    <OfficialPageShell
      badge="Terms of Service"
      title="The basic rules for using TokenSight AI."
      description="These terms describe platform access, acceptable use, service limitations, and the responsibilities users keep when relying on TokenSight AI for research workflows."
      updatedOn="April 14, 2026"
      highlights={[
        "TokenSight AI is a research tool, not financial advice.",
        "Users are responsible for their own trading and wallet decisions.",
        "Platform access can change as features evolve or abuse is detected.",
      ]}
    >
      <h2>Acceptance of terms</h2>
      <p>
        By accessing or using TokenSight AI, you agree to these Terms of Service. If you do not agree, you should not use the platform.
      </p>

      <h2>Service description</h2>
      <p>
        TokenSight AI provides token research, analytics, alerting, and workflow features for the Solana ecosystem. The service is offered on an informational basis to help users review token data and organize research activity.
      </p>

      <h2>No financial advice</h2>
      <p>
        TokenSight AI does not provide investment, legal, accounting, or tax advice. Any scan output, score, summary, ranking, or alert is provided for informational purposes only. You remain solely responsible for evaluating any trade, position, or wallet interaction.
      </p>

      <h2>User responsibilities</h2>
      <ul>
        <li>Use the platform lawfully and only for legitimate research or monitoring purposes.</li>
        <li>Maintain the security of your own accounts, wallets, devices, and linked services.</li>
        <li>Verify important information independently before acting on it.</li>
        <li>Avoid misuse of the service, including scraping abuse, interference, or attempts to access data that does not belong to you.</li>
      </ul>

      <h2>Availability and changes</h2>
      <p>
        Features, pages, integrations, and limits may change over time. TokenSight AI may update, suspend, restrict, or remove parts of the service at any time, including in response to abuse, infrastructure issues, provider changes, or product evolution.
      </p>

      <h2>Third-party dependencies</h2>
      <p>
        Some platform functionality depends on third-party providers, blockchain networks, or external data sources. TokenSight AI is not responsible for outages, inaccuracies, delays, or failures caused by those external systems.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, TokenSight AI is provided on an &quot;as is&quot; and &quot;as available&quot; basis without warranties of any kind. The platform is not liable for losses, damages, missed opportunities, or trading outcomes resulting from use of or reliance on the service.
      </p>

      <h2>Updates to these terms</h2>
      <p>
        These terms may be revised from time to time. Continued use of the platform after changes are published will be treated as acceptance of the updated version.
      </p>

      <p>
        You can also review the <Link href="/privacy-policy" className="text-primary hover:underline">Privacy Policy</Link> and the <Link href="/about" className="text-primary hover:underline">About page</Link> for related platform information.
      </p>
    </OfficialPageShell>
  );
}
