"use client"

import { PrivyProvider } from "@privy-io/react-auth"
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana"
import { brandIconPath } from "@/lib/seo"

const solanaConnectors = toSolanaWalletConnectors()

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || ""}
      config={{
        loginMethods: ["google", "github", "twitter", "email", "wallet"],
        appearance: {
          theme: "dark",
          accentColor: "#6366f1",
          logo: brandIconPath,
          showWalletLoginFirst: false,
        },
        embeddedWallets: {
          solana: {
            createOnLogin: "off",
          },
        },
        externalWallets: {
          solana: { connectors: solanaConnectors },
        },
      }}
    >
      {children}
    </PrivyProvider>
  )
}
