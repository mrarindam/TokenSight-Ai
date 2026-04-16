import Link from "next/link";
import { ArrowRight, FileText, ShieldCheck } from "lucide-react";

type OfficialPageShellProps = {
  badge: string;
  title: string;
  description: string;
  updatedOn: string;
  highlights: string[];
  children: React.ReactNode;
};

const QUICK_LINKS = [
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/docs", label: "Docs" },
  { href: "/privacy-policy", label: "Privacy Policy" },
  { href: "/terms-of-service", label: "Terms of Service" },
];

export function OfficialPageShell({
  badge,
  title,
  description,
  updatedOn,
  highlights,
  children,
}: OfficialPageShellProps) {
  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-0 hero-grid opacity-30" />
      <div className="absolute left-[-10%] top-16 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute bottom-0 right-[-8%] h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />

      <div className="dashboard-shell relative py-12 md:py-16">
        <div className="grid gap-8 lg:grid-cols-[1.45fr_0.75fr]">
          <section className="dashboard-surface p-6 md:p-8 lg:p-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.28em] text-primary">
              <ShieldCheck className="h-3.5 w-3.5" />
              {badge}
            </div>

            <h1 className="mt-5 max-w-3xl text-3xl font-black tracking-tight text-foreground md:text-5xl">
              {title}
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-muted-foreground/80 md:text-base">
              {description}
            </p>

            <div className="mt-6 inline-flex rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
              Last updated: {updatedOn}
            </div>
          </section>

          <aside className="space-y-6">
            <div className="dashboard-surface p-6">
              <div className="flex items-center gap-3">
                <div className="terminal-icon-tile h-11 w-11">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">What this page covers</p>
                  <p className="text-xs text-muted-foreground/70">A quick summary of the most important points.</p>
                </div>
              </div>

              <ul className="mt-5 space-y-3 text-sm text-muted-foreground/80">
                {highlights.map((item) => (
                  <li key={item} className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="dashboard-surface p-6">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-muted-foreground/50">
                Quick Links
              </p>

              <div className="mt-4 space-y-2">
                {QUICK_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center justify-between rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-primary/20 hover:bg-primary/10 hover:text-foreground"
                  >
                    {link.label}
                    <ArrowRight className="h-4 w-4 text-primary" />
                  </Link>
                ))}
              </div>
            </div>
          </aside>
        </div>

        <section className="dashboard-surface mt-8 p-6 md:p-8 lg:p-10">
          <div className="max-w-none [&_h2]:mt-8 [&_h2]:text-2xl [&_h2]:font-black [&_h2]:tracking-tight [&_h2:first-child]:mt-0 [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_li]:text-muted-foreground/80 [&_p]:mt-4 [&_p]:text-sm [&_p]:leading-7 [&_p]:text-muted-foreground/80 [&_ul]:mt-4 [&_ul]:space-y-2 md:[&_p]:text-base">
            {children}
          </div>
        </section>
      </div>
    </div>
  );
}
