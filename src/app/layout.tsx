import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { cn } from "@/lib/utils";

import { ThemeProvider } from "@/components/theme-provider";
import { Providers } from "@/components/Providers";
import { Navbar } from "@/components/layout/Navbar";
import { SiteFooter } from "@/components/layout/SiteFooter";
import {
  brandAppleIconPath,
  brandFavicon16Path,
  brandFavicon32Path,
  brandFaviconPath,
  brandManifestPath,
  defaultDescription,
  defaultKeywords,
  defaultTitle,
  siteName,
  siteUrl,
} from "@/lib/seo";

const FloatingAiChat = dynamic(
  () => import("@/components/FloatingAiChat").then((module) => module.FloatingAiChat),
  { ssr: false }
);

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: defaultTitle,
    template: `%s | ${siteName}`,
  },
  description: defaultDescription,
  applicationName: siteName,
  keywords: defaultKeywords,
  category: "finance",
  icons: {
    icon: [
      { url: brandFaviconPath, sizes: "any" },
      { url: brandFavicon32Path, sizes: "32x32", type: "image/png" },
      { url: brandFavicon16Path, sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: brandAppleIconPath, sizes: "180x180", type: "image/png" }],
    shortcut: [brandFaviconPath],
  },
  manifest: brandManifestPath,
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    siteName,
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn("min-h-screen flex flex-col antialiased overflow-x-hidden overflow-y-auto w-full max-w-full relative")}>
        <Providers>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange
          >
            <Navbar />
            <main className="flex-1 flex flex-col">{children}</main>
            <SiteFooter />
            <FloatingAiChat />
            <SpeedInsights />
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  );
}
