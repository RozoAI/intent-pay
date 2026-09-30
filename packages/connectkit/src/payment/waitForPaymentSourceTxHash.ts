import { getPayment } from "@rozoai/intent-common";
import { type Hex, isHex } from "viem";

type Options<TxHash extends string> = {
  signal?: AbortSignal;
  intervalMs?: number;
  ignoreTxHash?: string | null;
  isValidTxHash?: (txHash: string) => txHash is TxHash;
  fetchSourceTxHash?: (
    paymentId: string,
    signal?: AbortSignal,
  ) => Promise<string | undefined>;
};

const fetchSourceTxHash = async (
  paymentId: string,
  signal?: AbortSignal,
): Promise<string | undefined> => {
  const response = await getPayment(paymentId, "v2", { signal });
  return response.data?.source?.txHash ?? undefined;
};

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const cleanup = () => signal?.removeEventListener("abort", onAbort);
    const onAbort = () => {
      if (timeout) clearTimeout(timeout);
      cleanup();
      const error = new Error("Aborted");
      error.name = "AbortError";
      reject(error);
    };

    if (signal?.aborted) return onAbort();
    signal?.addEventListener("abort", onAbort, { once: true });
    timeout = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
  });

/** Recovers a tx hash when a wallet submits but never returns its response. */
export async function waitForPaymentSourceTxHash<TxHash extends string = Hex>(
  paymentId: string,
  options: Options<TxHash> = {},
): Promise<TxHash> {
  const {
    signal,
    intervalMs = 1_000,
    ignoreTxHash,
    isValidTxHash = isHex as (txHash: string) => txHash is TxHash,
    fetchSourceTxHash: fetchHash = fetchSourceTxHash,
  } = options;

  while (!signal?.aborted) {
    try {
      const txHash = await fetchHash(paymentId, signal);
      if (
        typeof txHash === "string" &&
        txHash !== ignoreTxHash &&
        isValidTxHash(txHash)
      ) {
        return txHash;
      }
    } catch (error) {
      if (signal?.aborted) throw error;
    }

    await wait(intervalMs, signal);
  }

  const error = new Error("Aborted");
  error.name = "AbortError";
  throw error;
}
