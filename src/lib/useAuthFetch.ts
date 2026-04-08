"use client"

import { usePrivy } from "@privy-io/react-auth"
import { useCallback } from "react"

/**
 * Hook to get authenticated fetch function that includes Privy auth token.
 */
export function useAuthFetch() {
  const { getAccessToken } = usePrivy()

  const authFetch = useCallback(
    async (url: string, options?: RequestInit) => {
      const token = await getAccessToken()
      return fetch(url, {
        ...options,
        headers: {
          ...options?.headers,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })
    },
    [getAccessToken],
  )

  return authFetch
}
