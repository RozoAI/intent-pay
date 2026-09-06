import { describe, expect, it } from "vitest";
import { createRequestGeneration } from "../src/utils/paymentRequestScope.js";

describe("createRequestGeneration", () => {
  it("latest generation is current, older ones are stale", () => {
    const gen = createRequestGeneration();
    const first = gen.next();
    expect(gen.isStale(first)).toBe(false);
    const second = gen.next();
    expect(gen.isStale(first)).toBe(true);
    expect(gen.isStale(second)).toBe(false);
  });

  it("out-of-order finish: superseded option request finishing last applies nothing", async () => {
    const gen = createRequestGeneration();
    const applied: string[] = [];
    const commitIfCurrent = (label: string, myGen: number) => {
      // Mirrors payWithDepositAddress: every shared-state mutation
      // (setRozoPaymentId, order hydration, error dispatch) is skipped
      // when the generation is stale.
      if (!gen.isStale(myGen)) applied.push(label);
    };

    // User picks option A, then switches to option B while A is in flight.
    const genA = gen.next();
    const genB = gen.next();

    // B's creation finishes first and commits.
    commitIfCurrent("B", genB);

    // A's creation finishes last (slow chain) — must be dropped.
    let resolveA!: () => void;
    const pendingA = new Promise<void>((r) => {
      resolveA = r;
    });
    resolveA();
    await pendingA;
    commitIfCurrent("A", genA);

    expect(applied).toEqual(["B"]);
  });
});
