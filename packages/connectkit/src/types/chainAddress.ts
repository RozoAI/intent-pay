import { PublicKey } from "@solana/web3.js";
import { StrKey } from "@stellar/stellar-sdk";
import { Address, isAddress } from "viem";

// Define chain ID constants
// @NOTE: These are the chain IDs for the chains that are supported by the SDK.
export const EVM_CHAIN_IDS = {
  BASE: 8453,
  ETHEREUM: 1,
  POLYGON: 137,
} as const;

export const NON_EVM_CHAIN_IDS = {
  SOLANA: 900,
  STELLAR: 1500,
} as const;

export type EvmChainId = (typeof EVM_CHAIN_IDS)[keyof typeof EVM_CHAIN_IDS];
export type NonEvmChainId =
  (typeof NON_EVM_CHAIN_IDS)[keyof typeof NON_EVM_CHAIN_IDS];
export type SupportedChainId = EvmChainId | NonEvmChainId;

// Type guards
export function isEvmChain(chainId: number): chainId is EvmChainId {
  return Object.values(EVM_CHAIN_IDS).includes(chainId as EvmChainId);
}

export function isSolanaChain(chainId: number): boolean {
  return chainId === NON_EVM_CHAIN_IDS.SOLANA;
}

export function isStellarChain(chainId: number): boolean {
  return chainId === NON_EVM_CHAIN_IDS.STELLAR;
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
  address: string
): boolean {
  if (isEvmChain(chainId)) {
    return isValidEvmAddress(address);
  } else if (isSolanaChain(chainId)) {
    return isValidSolanaAddress(address);
  } else if (isStellarChain(chainId)) {
    return isValidStellarAddress(address);
  }
  return false;
}

/**
 * Returns a human-readable chain type name
 */
export function getChainTypeName(chainId: number): string {
  if (isEvmChain(chainId)) {
    switch (chainId) {
      case EVM_CHAIN_IDS.BASE:
        return "Base";
      case EVM_CHAIN_IDS.ETHEREUM:
        return "Ethereum";
      case EVM_CHAIN_IDS.POLYGON:
        return "Polygon";
      default:
        return "EVM";
    }
  } else if (isSolanaChain(chainId)) {
    return "Solana";
  } else if (isStellarChain(chainId)) {
    return "Stellar";
  }
  return "Unknown";
}
