/**
 * SVM / Solana Wallet logic for Phantom integration.
 * Handles the phantom provider detection, connection, and message signing.
 */

interface SolanaProvider {
  isPhantom?: boolean;
  connect(): Promise<{ publicKey: { toString(): string } }>;
  disconnect(): Promise<void>;
  signMessage(message: Uint8Array, encoding: string): Promise<{ signature: Uint8Array }>;
  signAndSendTransaction(
    transaction: import("@solana/web3.js").VersionedTransaction,
    options?: { skipPreflight?: boolean }
  ): Promise<{ signature: string }>;
  publicKey?: { toString(): string } | null;
  isConnected?: boolean;
}

export const SIGN_MESSAGE_PREFIX = "TokenSight AI Wallet Verification\n\nSign this message to link your wallet.\nThis does not cost any SOL.\n\nNonce: "

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

export const disconnectPhantom = async (): Promise<void> => {
  const provider = getPhantomProvider();
  if (provider) {
    try {
      await provider.disconnect();
    } catch (err) {
      console.error("Phantom disconnect failed:", err);
    }
  }
};

/**
 * Connect wallet and sign a verification message.
 * Returns { address, signature, nonce } for server-side verification.
 */
export const connectAndSign = async (): Promise<{
  address: string;
  signature: string;
  nonce: string;
} | null> => {
  const provider = getPhantomProvider();
  
  if (!provider) {
    window.open("https://phantom.app/", "_blank");
    return null;
  }

  try {
    const resp = await provider.connect();
    const address = resp.publicKey.toString();

    // Generate a random nonce
    const nonce = crypto.randomUUID();
    const message = new TextEncoder().encode(SIGN_MESSAGE_PREFIX + nonce);

    const { signature } = await provider.signMessage(message, "utf8");

    // Encode signature as base58 for transport
    const signatureBase58 = encodeBase58(signature);

    return { address, signature: signatureBase58, nonce };
  } catch (err) {
    console.error("Wallet sign failed:", err);
    return null;
  }
};

/** Simple base58 encoder (Bitcoin alphabet) */
function encodeBase58(bytes: Uint8Array): string {
  const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const BASE = 58;
  
  if (bytes.length === 0) return "";
  
  // Count leading zeros
  let zeroes = 0;
  while (zeroes < bytes.length && bytes[zeroes] === 0) zeroes++;
  
  // Convert to base58
  const size = Math.ceil(bytes.length * 138 / 100) + 1;
  const b58 = new Uint8Array(size);
  
  for (let i = zeroes; i < bytes.length; i++) {
    let carry = bytes[i];
    let j = size - 1;
    while (carry !== 0 || j >= 0) {
      if (j < 0) break;
      carry += 256 * b58[j];
      b58[j] = carry % BASE;
      carry = Math.floor(carry / BASE);
      j--;
      if (carry === 0 && b58.slice(0, j + 1).every(v => v === 0)) break;
    }
  }
  
  // Skip leading zeros in b58
  let start = 0;
  while (start < size && b58[start] === 0) start++;
  
  let result = "";
  for (let i = 0; i < zeroes; i++) result += ALPHABET[0];
  for (let i = start; i < size; i++) result += ALPHABET[b58[i]];
  
  return result;
}

/**
 * Sign and send a swap transaction using Phantom wallet.
 * Takes the base64-encoded transaction from Jupiter /order API.
 * Uses VersionedTransaction from @solana/web3.js for proper deserialization.
 * Returns the transaction signature.
 */
export const signAndSendSwapTransaction = async (
  transactionBase64: string
): Promise<string> => {
  const { VersionedTransaction } = await import("@solana/web3.js");

  const provider = getPhantomProvider();
  if (!provider) throw new Error("Phantom wallet not found");

  if (!provider.isConnected) {
    await provider.connect();
  }

  // Decode base64 → bytes → VersionedTransaction
  const transactionBuf = Uint8Array.from(atob(transactionBase64), c => c.charCodeAt(0));
  const transaction = VersionedTransaction.deserialize(transactionBuf);

  // Phantom signs and sends in one step (recommended by Phantom docs)
  const { signature } = await provider.signAndSendTransaction(transaction, {
    skipPreflight: false,
  });

  return signature;
};
