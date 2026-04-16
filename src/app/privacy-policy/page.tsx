import Link from "next/link";
import { OfficialPageShell } from "@/components/site/OfficialPageShell";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "Privacy Policy",
  description:
    "Read how TokenSight AI handles account details, saved app data, and third-party integrations used to power the platform.",
  path: "/privacy-policy",
  keywords: [
    "tokensight ai privacy policy",
    "solana app privacy policy",
    "privacy policy crypto analytics platform",
  ],
});

export default function PrivacyPolicyPage() {
  return (
    <OfficialPageShell
      badge="Privacy Policy"
      title="How TokenSight AI handles account and platform data."
      description="This page explains the kinds of information the platform uses, why that information is needed, and how it supports product features such as accounts, scans, alerts, and saved user workflows."
      updatedOn="April 14, 2026"
      highlights={[
        "What account details and app data may be stored.",
        "How third-party services support login and product functionality.",
        "What users can expect around saved scans, alerts, and linked settings.",
      ]}
    >
      <h2>Scope</h2>
      <p>
        This Privacy Policy applies to TokenSight AI and the connected web experience available through the platform. It describes how information is used when you browse the site, sign in, run scans, save preferences, or connect optional features.
      </p>

      <h2>Information we may process</h2>
      <ul>
        <li>Account details such as email address, wallet address, username, display name, and linked social identity when provided through supported login methods.</li>
        <li>User-generated app data such as saved portfolio entries, price alerts, linked Telegram settings, and scan history associated with an account.</li>
        <li>Technical and usage data needed to operate the app, secure sessions, and diagnose issues.</li>
        <li>Public blockchain and market data pulled from integrated providers in order to generate token analysis results.</li>
      </ul>

      <h2>How information is used</h2>
      <ul>
        <li>To authenticate users and maintain access to account-specific features.</li>
        <li>To provide scans, alerts, portfolio tools, profile customization, and related product functionality.</li>
        <li>To improve product stability, understand usage patterns, and monitor service quality.</li>
        <li>To support notifications or linked experiences that users explicitly enable.</li>
      </ul>

      <h2>Third-party services</h2>
      <p>
        TokenSight AI relies on third-party infrastructure and data providers to power parts of the experience, including authentication, storage, blockchain analysis, and market data delivery. Those providers may process information as required to deliver their services to the platform.
      </p>

      <h2>Data retention</h2>
      <p>
        Information may be retained for as long as it is needed to operate the service, preserve account continuity, maintain saved features, comply with legal obligations, or resolve disputes. Retention periods can vary depending on the type of data and the purpose it supports.
      </p>

      <h2>Your choices</h2>
      <p>
        You can choose whether to create an account, whether to connect optional services, and whether to save platform data such as portfolio entries or alerts. If you stop using the service, some records may still be retained where reasonably necessary for security, recordkeeping, or operational continuity.
      </p>

      <h2>Policy updates</h2>
      <p>
        This page may be updated as TokenSight AI evolves. Material changes should be reflected by revising the effective date shown above.
      </p>

      <p>
        For a broader overview of the product, visit <Link href="/about" className="text-primary hover:underline">About TokenSight AI</Link> or review the <Link href="/docs" className="text-primary hover:underline">documentation</Link>.
      </p>
    </OfficialPageShell>
  );
}
