import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { cn } from "@/lib/utils";

import { ThemeProvider } from "@/components/theme-provider";
import { Providers } from "@/components/Providers";
import { Navbar } from "@/components/layout/Navbar";

const FloatingAiChat = dynamic(
  () => import("@/components/FloatingAiChat").then((module) => module.FloatingAiChat),
  { ssr: false }
);

export const metadata: Metadata = {
  title: "TokenSight AI - Smart Token Discovery",
  description:
    "AI-powered token intelligence. Analyze both early-stage and established tokens across the ecosystem for confident, data-driven entry decisions.",
  keywords: ["crypto", "token intelligence", "scanner", "AI", "defi", "entry signals", "smart money"],
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
            <FloatingAiChat />
            <SpeedInsights />
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  );
}
