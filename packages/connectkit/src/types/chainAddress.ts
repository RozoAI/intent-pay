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
