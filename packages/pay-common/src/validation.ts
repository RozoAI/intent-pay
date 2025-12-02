import { PublicKey } from "@solana/web3.js";
import { Address } from "@stellar/stellar-sdk";
import { getAddress } from "viem";
import { Chain, supportedChains } from "./chain";
import { getKnownToken } from "./token";

// Type guards
export function isChainSupported(
  chainId: number,
  type?: "evm" | "solana" | "stellar"
): boolean {
  return supportedChains.some(
    (chain: Chain) =>
      chain.chainId === chainId && (type ? chain.type === type : true)
  );
}

export function isTokenSupported(
  chainId: number,
  tokenAddress: string
): boolean {
  return !!getKnownToken(chainId, tokenAddress);
}

// Validation helpers
export function isValidEvmAddress(address: string): boolean {
  return !!getAddress(address);
}

export function isValidSolanaAddress(address: string): boolean {
  const key = new PublicKey(address);
  return PublicKey.isOnCurve(key.toBytes());
}

export function isValidStellarAddress(address: string): boolean {
  return !!Address.fromString(address);
}

/**
 * Validates that an address matches the expected format for a given chain
 */
export function validateAddressForChain(
  chainId: number,
  address: string
): boolean {
  if (isChainSupported(chainId, "evm")) {
    return !!getAddress(address);
  } else if (isChainSupported(chainId, "solana")) {
    return isValidSolanaAddress(address);
  } else if (isChainSupported(chainId, "stellar")) {
    return isValidStellarAddress(address);
  }
  return false;
}
