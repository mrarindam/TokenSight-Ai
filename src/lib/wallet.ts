/**
 * SVM / Solana Wallet logic for Phantom integration.
 * Handles the phantom provider detection and basic connection flow.
 */

interface SolanaProvider {
  isPhantom?: boolean;
  connect(): Promise<{ publicKey: { toString(): string } }>;
}

export const getPhantomProvider = () => {
  if (typeof window !== "undefined" && "solana" in window) {
    const provider = (window as unknown as { solana: SolanaProvider }).solana;
    if (provider.isPhantom) return provider;
  }
  return null;
};

export const connectPhantom = async (): Promise<string | null> => {
  const provider = getPhantomProvider();
  
  if (!provider) {
    window.open("https://phantom.app/", "_blank");
    return null;
  }

  try {
    const resp = await provider.connect();
    return resp.publicKey.toString();
  } catch (err) {
    console.error("Phantom connection failed:", err);
    return null;
  }
};
