import Image from "next/image";
import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";
import { brandIconPath } from "@/lib/seo";

const platformLinks = [
  { href: "/", label: "Feed" },
  { href: "/scan", label: "Scan" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/alerts", label: "Alerts" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/docs", label: "Docs" },
];

const companyLinks = [
  { href: "/about", label: "About TokenSight AI" },
  { href: "/contact", label: "Contact Us" },
  { href: "/scan/history", label: "Scan History" },
  { href: "/settings/telegram", label: "Telegram Setup" },
];

const legalLinks = [
  { href: "/privacy-policy", label: "Privacy Policy" },
  { href: "/terms-of-service", label: "Terms of Service" },
];

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <div className="relative border-t border-white/[0.05]">
      <div className="absolute inset-0 hero-grid opacity-20" />
      <div className="absolute left-[8%] top-16 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute bottom-0 right-[10%] h-56 w-56 rounded-full bg-cyan-500/10 blur-3xl" />

      <div className="dashboard-shell relative py-14 md:py-20">
        <footer className="dashboard-surface px-6 py-8 md:px-10 md:py-10">
          <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr]">
            <div className="max-w-sm">
              <Link href="/" className="inline-flex items-center gap-3">
                <div className="relative rounded-2xl border border-primary/20 bg-card/70 p-2 shadow-[0_12px_30px_-18px_rgba(59,130,246,0.55)]">
                  <div className="overflow-hidden rounded-[0.95rem] bg-[#020408] ring-1 ring-white/6">
                    <Image src={brandIconPath} alt="TokenSight AI logo" width={36} height={36} className="h-9 w-9 object-cover" />
                  </div>
                  <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_16px_rgba(74,222,128,0.95)]" />
                </div>
                <div>
                  <p className="text-lg font-black tracking-tight text-foreground">
                    TokenSight <span className="text-primary">AI</span>
                  </p>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground/55">
                    Solana Intelligence Platform
                  </p>
                </div>
              </Link>

              <p className="mt-5 text-sm leading-7 text-muted-foreground/80">
                TokenSight AI helps traders evaluate Solana tokens with liquidity analysis, holder insights, live risk signals, alerts, and portfolio tools in one place.
              </p>
            </div>

            <FooterColumn title="Platform" links={platformLinks} />
            <FooterColumn title="Company" links={companyLinks} />
            <FooterColumn title="Legal" links={legalLinks} />
          </div>

          <div className="mt-8 flex flex-col gap-4 border-t border-white/[0.08] pt-6 text-sm text-muted-foreground/70 md:flex-row md:items-center md:justify-between">
            <p>&copy; {year} TokenSight AI. Built for faster Solana token research.</p>
            <div className="flex flex-wrap gap-4">
              <Link href="/about" className="inline-flex items-center gap-2 transition-colors hover:text-foreground">
                <FileText className="h-4 w-4 text-primary" />
                About
              </Link>
              <Link href="/contact" className="transition-colors hover:text-foreground">
                Contact
              </Link>
              <Link href="/privacy-policy" className="transition-colors hover:text-foreground">
                Privacy Policy
              </Link>
              <Link href="/terms-of-service" className="transition-colors hover:text-foreground">
                Terms of Service
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: Array<{ href: string; label: string }>;
}) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.24em] text-muted-foreground/50">{title}</p>
      <div className="mt-4 space-y-2">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex items-center justify-between rounded-2xl border border-transparent px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:border-primary/15 hover:bg-primary/10 hover:text-foreground"
          >
            {link.label}
            <ArrowRight className="h-4 w-4 text-primary/70" />
          </Link>
        ))}
      </div>
    </div>
  );
}
