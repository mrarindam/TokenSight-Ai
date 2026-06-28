"use client"

import { useState, useEffect } from "react"
import { PrivyProvider } from "@privy-io/react-auth"
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana"
import { brandIconPath } from "@/lib/seo"
import { useTheme } from "next-themes"

const solanaConnectors = toSolanaWalletConnectors()

export function Providers({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme()
  const currentTheme = resolvedTheme === "light" ? "light" : "dark"
  const [origin, setOrigin] = useState("https://tokensight.ai")

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin)
    }
  }, [])

  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || ""}
      config={{
        loginMethods: ["google", "github", "twitter", "email", "wallet"],
        appearance: {
          theme: currentTheme,
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
        legal: {
          termsAndConditionsUrl: `${origin}/terms-of-service`,
          privacyPolicyUrl: `${origin}/privacy-policy`,
        },
      }}
    >
      {children}
    </PrivyProvider>
  )
}
