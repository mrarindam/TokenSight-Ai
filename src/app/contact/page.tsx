import Link from "next/link";
import { ExternalLink, Mail, MessageCircle, Send } from "lucide-react";
import { OfficialPageShell } from "@/components/site/OfficialPageShell";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "Contact Arindam",
  description:
    "Get in touch with Arindam, the builder behind TokenSight AI, through Telegram, email, Twitter, or portfolio links.",
  path: "/contact",
  keywords: [
    "contact tokensight ai",
    "contact arindam",
    "tokensight ai builder",
    "tokensight support contact",
  ],
});

const contactLinks = [
  {
    href: "https://t.me/MrxArindam",
    label: "Telegram",
    value: "@MrxArindam",
    icon: MessageCircle,
    description: "Best for quick replies, collaboration, and direct discussion.",
  },
  {
    href: "mailto:marindam342@gmail.com",
    label: "Email",
    value: "marindam342@gmail.com",
    icon: Mail,
    description: "Best for detailed questions, partnerships, and formal contact.",
  },
  {
    href: "https://x.com/TokenSightAi",
    label: "Twitter",
    value: "@TokenSightAi",
    icon: Send,
    description: "Follow platform updates and reach out through X.",
  },
  {
    href: "https://mrarindam.vercel.app/",
    label: "Portfolio",
    value: "mrarindam.vercel.app",
    icon: ExternalLink,
    description: "See more work, projects, and the builder profile for Arindam.",
  },
];

export default function ContactPage() {
  return (
    <OfficialPageShell
      badge="Contact Me"
      title="Reach Arindam, the builder behind TokenSight AI."
      description="If you want to collaborate, ask product questions, discuss ideas, or connect about the platform, you can reach out directly through the channels below."
      updatedOn="April 14, 2026"
      highlights={[
        "Direct contact options for Telegram, email, Twitter, and portfolio.",
        "Builder credit and personal portfolio link for Arindam.",
        "A cleaner official page that can live in the site footer.",
      ]}
    >
      <h2>Contact channels</h2>
      <p>
        TokenSight AI is built by <strong className="text-foreground">Arindam</strong>. If you want to connect about the project, partnerships, feedback, feature ideas, or general questions, use any of the channels below.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {contactLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            target="_blank"
            rel="noreferrer"
            className="rounded-[1.5rem] border border-white/[0.08] bg-white/[0.03] p-5 transition-colors hover:border-primary/20 hover:bg-primary/10"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-[0.18em] text-primary">
                  <link.icon className="h-4 w-4" />
                  {link.label}
                </div>
                <p className="mt-3 text-lg font-bold text-foreground">{link.value}</p>
                <p className="mt-2 text-sm leading-7 text-muted-foreground/80">{link.description}</p>
              </div>
              <ExternalLink className="mt-1 h-4 w-4 text-muted-foreground/60" />
            </div>
          </Link>
        ))}
      </div>

      <h2>Builder</h2>
      <p>
        TokenSight AI is designed and developed by <strong className="text-foreground">Arindam</strong>. You can explore more of his work through the{" "}
        <Link href="https://mrarindam.vercel.app/" target="_blank" rel="noreferrer" className="text-primary hover:underline">
          portfolio website
        </Link>
        .
      </p>
    </OfficialPageShell>
  );
}
