/**
 * Persists Stellar transactions whose wallet submission outcome is not yet
 * proven, per source account and keyed by tx hash. While any record exists,
 * no new signature may be requested from that account until each record is
 * resolved on chain (see resolveStellarSubmissionOutcome). This survives the
 * payment component unmounting, a new order being created, other tabs and
 * page reloads, so leaving and re-entering checkout cannot bypass the guard.
 *
 * Records are keyed by tx hash so a late wallet response for one
 * transaction can only update or clear its own record, never another one.
 *
 * localStorage is the shared source of truth (other tabs and reloads see
 * it). Only when a storage write fails does an in-memory override for that
 * account take precedence in this page, so a stale storage value cannot
 * override newer in-page state, while a working storage still lets other
 * tabs' records be seen. If a storage read throws, the last state this page
 * wrote or read is used instead of treating it as "no records".
 *
 * A record whose tx was confirmed (confirmed: true) is kept so a second
 * checkout from the same account must be explicitly acknowledged; confirmed
 * records lapse after CONFIRMED_ENTRY_TTL_MS.
 */

export const CONFIRMED_ENTRY_TTL_MS = 60 * 60 * 1000;

export type StellarPendingSubmission = {
  txHash: string;
  /** Timebounds max_time in unix seconds, 0 when unbounded. */
  maxTime: number;
  paymentId?: string;
  walletStatus?: string;
  /** True once the tx was found successful on chain (or by the API). */
  confirmed?: boolean;
  recordedAt: number;
};

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type Records = Record<string, StellarPendingSubmission>;

const KEY_PREFIX = "rozo_stellar_pending_submission:";
/** Overrides for accounts whose storage write failed (serialized records). */
const memoryOverrides = new Map<string, string>();
/** Last state this page wrote or read per account, used if a read throws. */
const pageCopies = new Map<string, string>();

const defaultStorage = (): StorageLike | undefined => {
  try {
    return typeof localStorage !== "undefined" ? localStorage : undefined;
  } catch {
    return undefined;
  }
};

const isTxHash = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{64}$/i.test(value);

function normalize(value: unknown): StellarPendingSubmission | undefined {
  if (!value || typeof value !== "object") return undefined;
  const parsed = value as Partial<StellarPendingSubmission>;
  if (!isTxHash(parsed.txHash)) return undefined;
  return {
    txHash: parsed.txHash,
    maxTime: typeof parsed.maxTime === "number" ? parsed.maxTime : 0,
    paymentId:
      typeof parsed.paymentId === "string" ? parsed.paymentId : undefined,
    walletStatus:
      typeof parsed.walletStatus === "string" ? parsed.walletStatus : undefined,
    confirmed: parsed.confirmed === true,
    recordedAt: typeof parsed.recordedAt === "number" ? parsed.recordedAt : 0,
  };
}

function loadRecords(account: string, storage?: StorageLike): Records {
  const key = KEY_PREFIX + account;
  let raw: string | null | undefined = memoryOverrides.get(key);
  if (raw === undefined) {
    try {
      raw = storage ? storage.getItem(key) : pageCopies.get(key);
      if (storage) {
        if (raw) pageCopies.set(key, raw);
        else pageCopies.delete(key);
      }
    } catch {
      raw = pageCopies.get(key);
    }
  }
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    const records: Records = {};
    if (parsed && typeof parsed === "object") {
      for (const value of Object.values(parsed as Record<string, unknown>)) {
        const entry = normalize(value);
        if (entry) records[entry.txHash.toLowerCase()] = entry;
      }
    }
    return records;
  } catch {
    return {};
  }
}

function storeRecords(
  account: string,
  records: Records,
  storage?: StorageLike,
): void {
  const key = KEY_PREFIX + account;
  const empty = Object.keys(records).length === 0;
  const raw = JSON.stringify(records);
  if (empty) pageCopies.delete(key);
  else pageCopies.set(key, raw);
  try {
    if (!storage) throw new Error("no storage");
    if (empty) storage.removeItem(key);
    else storage.setItem(key, raw);
    memoryOverrides.delete(key);
  } catch {
    memoryOverrides.set(key, raw);
  }
}

/** Insert or replace the record for entry.txHash only. */
export function savePendingStellarSubmission(
  account: string,
  entry: StellarPendingSubmission,
  storage: StorageLike | undefined = defaultStorage(),
): void {
  const records = loadRecords(account, storage);
  records[entry.txHash.toLowerCase()] = entry;
  storeRecords(account, records, storage);
}

/** All records for the account, oldest first. */
export function readPendingStellarSubmissions(
  account: string,
  storage: StorageLike | undefined = defaultStorage(),
): StellarPendingSubmission[] {
  return Object.values(loadRecords(account, storage)).sort(
    (a, b) => a.recordedAt - b.recordedAt,
  );
}

/** Remove the record for txHash only (optionally keeping a confirmed one). */
export function clearPendingStellarSubmission(
  account: string,
  txHash: string,
  storage: StorageLike | undefined = defaultStorage(),
  options: { keepConfirmed?: boolean } = {},
): void {
  const records = loadRecords(account, storage);
  const key = txHash.toLowerCase();
  const current = records[key];
  if (!current) return;
  if (options.keepConfirmed && current.confirmed) return;
  delete records[key];
  storeRecords(account, records, storage);
}
