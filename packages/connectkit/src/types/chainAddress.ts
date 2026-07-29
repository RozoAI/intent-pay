import { getChainById as getChainByIdUnsafe } from "@rozoai/intent-common";
import { PublicKey } from "@solana/web3.js";
import { StrKey } from "@stellar/stellar-sdk";
import { Address, isAddress } from "viem";

/** Safe getChainById — returns null instead of throwing for unknown chains. */
function getChainById(chainId: number) {
  try {
    return getChainByIdUnsafe(chainId);
  } catch {
    return null;
  }
}

// Validation helpers
export function isValidEvmAddress(address: string): address is Address {
  return isAddress(address);
}

export function isValidSolanaAddress(address: string): boolean {
  const key = new PublicKey(address);
  return PublicKey.isOnCurve(key.toBytes());
}

export function isValidStellarAddress(address: string): boolean {
  return (
    StrKey.isValidEd25519PublicKey(address) ||
    StrKey.isValidMed25519PublicKey(address)
  );
}

/**
 * Validates that an address matches the expected format for a given chain
 */
export function validateAddressForChain(
  chainId: number,
  address: string,
): boolean {
  const chain = getChainById(chainId);
  if (!chain) return false;

  if (chain.type === "evm") {
    return isValidEvmAddress(address);
  } else if (chain.type === "solana") {
    return isValidSolanaAddress(address);
  } else if (chain.type === "stellar") {
    return isValidStellarAddress(address);
  }
  return false;
}

/**
 * Same as validateAddressForChain, but loads @solana/web3.js / @stellar/stellar-sdk
 * lazily instead of eagerly. Those are ~14M/~11M and only needed for
 * non-EVM chains — internal callers on the render-critical path (e.g.
 * RozoPayButton's prop-validation effect) should use this instead of the
 * sync version to keep the two SDKs off first paint.
 */
export async function validateAddressForChainAsync(
  chainId: number,
  address: string,
): Promise<boolean> {
  const chain = getChainById(chainId);
  if (!chain) return false;

  if (chain.type === "evm") {
    return isValidEvmAddress(address);
  } else if (chain.type === "solana") {
    const { PublicKey } = await import("@solana/web3.js");
    const key = new PublicKey(address);
    return PublicKey.isOnCurve(key.toBytes());
  } else if (chain.type === "stellar") {
    const { StrKey } = await import("@stellar/stellar-sdk");
    return (
      StrKey.isValidEd25519PublicKey(address) ||
      StrKey.isValidMed25519PublicKey(address)
    );
  }
  return false;
}
