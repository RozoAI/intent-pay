import {
  ComputeBudgetProgram,
  type Connection,
  type PublicKey,
  type SignatureStatus,
  type TransactionInstruction,
} from "@solana/web3.js";

/**
 * Solana pay-in send helpers.
 *
 * Without a priority fee, and with a single wallet broadcast, a signed Solana
 * transaction can be dropped by congested leaders and never land. The user
 * then waits on the confirmation screen for a deposit that will never arrive
 * (2026-10-20: two $58.33 USDT payments signed in-wallet, validator reported
 * "transaction not found at finalized commitment").
 *
 * These helpers add a compute-unit price, rebroadcast the signed transaction
 * until it confirms or its blockhash expires, and report expiry explicitly so
 * the UI can tell the user the payment did not go through.
 */

/** Priority fee floor in micro-lamports per CU (always pay something). */
export const SOLANA_PRIORITY_FEE_MIN_MICROLAMPORTS = 10_000;
/**
 * Priority fee ceiling in micro-lamports per CU. With the largest CU limit
 * below (200k) this caps the priority fee at 0.0002 SOL per payment.
 */
export const SOLANA_PRIORITY_FEE_MAX_MICROLAMPORTS = 1_000_000;
/** Used when the RPC cannot return recent prioritization fees. */
export const SOLANA_PRIORITY_FEE_DEFAULT_MICROLAMPORTS = 50_000;

/** CU limit for a payment that also creates the recipient token account. */
export const SOLANA_CU_LIMIT_WITH_ATA_CREATE = 200_000;
/** CU limit for a plain SOL / SPL transfer (+ optional memo). */
export const SOLANA_CU_LIMIT_DEFAULT = 80_000;

export const SOLANA_REBROADCAST_INTERVAL_MS = 2_000;
/**
 * Wall-clock safety cap on the confirm loop. A blockhash is valid for ~150
 * blocks (~60-90 s); if we still cannot prove expiry after this long (RPC
 * outage), we stop waiting and hand off to the normal confirmation page
 * instead of claiming the payment failed.
 */
export const SOLANA_CONFIRM_MAX_WAIT_MS = 180_000;

export const SOLANA_TX_EXPIRED_MESSAGE =
  "Payment did not go through. The Solana network did not confirm your transaction before it expired, and no funds were moved. Please retry.";

export class SolanaTransactionExpiredError extends Error {
  readonly signature: string;
  constructor(signature: string) {
    super(SOLANA_TX_EXPIRED_MESSAGE);
    this.name = "SolanaTransactionExpiredError";
    this.signature = signature;
  }
}

export function isSolanaTransactionExpiredError(
  error: unknown,
): error is SolanaTransactionExpiredError {
  return (
    error instanceof SolanaTransactionExpiredError ||
    (error instanceof Error && error.name === "SolanaTransactionExpiredError")
  );
}

/**
 * Pick a priority fee from recent per-slot samples: 75th percentile of the
 * non-zero samples, clamped to [MIN, MAX].
 */
export function pickPriorityFeeMicroLamports(samples: readonly number[]): number {
  const nonZero = samples
    .filter((v) => Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b);
  if (nonZero.length === 0) return SOLANA_PRIORITY_FEE_MIN_MICROLAMPORTS;
  const idx = Math.min(nonZero.length - 1, Math.floor(nonZero.length * 0.75));
  const p75 = Math.ceil(nonZero[idx]);
  return Math.min(
    SOLANA_PRIORITY_FEE_MAX_MICROLAMPORTS,
    Math.max(SOLANA_PRIORITY_FEE_MIN_MICROLAMPORTS, p75),
  );
}

export async function estimatePriorityFeeMicroLamports(
  connection: Pick<Connection, "getRecentPrioritizationFees">,
  writableAccounts: PublicKey[],
): Promise<number> {
  try {
    const fees = await connection.getRecentPrioritizationFees({
      lockedWritableAccounts: writableAccounts,
    });
    return pickPriorityFeeMicroLamports(fees.map((f) => f.prioritizationFee));
  } catch {
    return SOLANA_PRIORITY_FEE_DEFAULT_MICROLAMPORTS;
  }
}

export function priorityFeeInstructions(
  computeUnitLimit: number,
  microLamports: number,
): TransactionInstruction[] {
  return [
    ComputeBudgetProgram.setComputeUnitLimit({ units: computeUnitLimit }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports }),
  ];
}

type ConfirmConnection = Pick<
  Connection,
  "sendRawTransaction" | "getSignatureStatuses" | "getBlockHeight"
>;

export type RebroadcastResult = { status: "confirmed" } | { status: "unknown" };

/** Errors from the first send that do not mean the transaction is bad. */
function isBenignSendError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return /already been processed|blockhash not found/i.test(msg);
}

function settledStatus(
  status: SignatureStatus | null | undefined,
): "confirmed" | "failed" | "pending" {
  if (!status) return "pending";
  if (status.err) return "failed";
  if (
    status.confirmationStatus === "confirmed" ||
    status.confirmationStatus === "finalized"
  ) {
    return "confirmed";
  }
  return "pending";
}

/**
 * Broadcast a signed transaction and keep rebroadcasting it until it is
 * confirmed, it fails on chain, or its blockhash has expired.
 *
 * - Resolves `{status: "confirmed"}` once the signature is confirmed.
 * - Throws `SolanaTransactionExpiredError` only after the *finalized* block
 *   height has passed `lastValidBlockHeight` and a full-history status lookup
 *   still finds nothing, i.e. the transaction can no longer land. This
 *   ordering is what makes "please retry" safe (no double payment).
 * - Throws on an on-chain failure or a non-benign preflight error.
 * - Resolves `{status: "unknown"}` if the wall-clock cap is hit before expiry
 *   can be proven (e.g. RPC outage); caller should fall back to the normal
 *   confirmation wait.
 */
export async function rebroadcastUntilConfirmed(params: {
  connection: ConfirmConnection;
  rawTransaction: Uint8Array;
  signature: string;
  lastValidBlockHeight: number;
  intervalMs?: number;
  maxWaitMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  log?: (...args: unknown[]) => void;
}): Promise<RebroadcastResult> {
  const {
    connection,
    rawTransaction,
    signature,
    lastValidBlockHeight,
    intervalMs = SOLANA_REBROADCAST_INTERVAL_MS,
    maxWaitMs = SOLANA_CONFIRM_MAX_WAIT_MS,
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
    now = () => Date.now(),
    log = () => {},
  } = params;

  const failOnChain = (status: SignatureStatus) => {
    throw new Error(
      `Solana transaction failed on chain: ${JSON.stringify(status.err)}`,
    );
  };

  const startedAt = now();
  let first = true;
  for (;;) {
    try {
      await connection.sendRawTransaction(rawTransaction, {
        // Preflight once so a genuinely bad tx (e.g. insufficient balance)
        // surfaces immediately; rebroadcasts skip it.
        skipPreflight: !first,
        preflightCommitment: "confirmed",
        maxRetries: 0,
      });
    } catch (error) {
      if (first && !isBenignSendError(error)) throw error;
      log("[PAY SOLANA] rebroadcast send error (ignored)", error);
    }
    first = false;

    try {
      const { value } = await connection.getSignatureStatuses([signature]);
      const status = value[0];
      const settled = settledStatus(status);
      if (settled === "confirmed") return { status: "confirmed" };
      if (settled === "failed" && status) failOnChain(status);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Solana transaction failed")) {
        throw error;
      }
      log("[PAY SOLANA] status poll error (ignored)", error);
    }

    let finalizedHeight: number | null = null;
    try {
      finalizedHeight = await connection.getBlockHeight("finalized");
    } catch (error) {
      log("[PAY SOLANA] block height poll error (ignored)", error);
    }

    if (finalizedHeight != null && finalizedHeight > lastValidBlockHeight) {
      // Blockhash expired as of a finalized block: the tx can no longer be
      // included. One last full-history lookup closes the race where it
      // landed between our polls.
      const { value } = await connection.getSignatureStatuses([signature], {
        searchTransactionHistory: true,
      });
      const status = value[0];
      const settled = settledStatus(status);
      if (settled === "failed" && status) failOnChain(status);
      if (status) return { status: "confirmed" };
      throw new SolanaTransactionExpiredError(signature);
    }

    if (now() - startedAt >= maxWaitMs) {
      log("[PAY SOLANA] confirm wait cap reached; handing off", { signature });
      return { status: "unknown" };
    }
    await sleep(intervalMs);
  }
}
