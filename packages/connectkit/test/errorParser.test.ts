import { describe, expect, it } from "vitest";

import {
  createPaymentFailureError,
  parseErrorMessage,
} from "../src/utils/errorParser";

describe("parseErrorMessage", () => {
  it("returns a plain Error's message", () => {
    expect(parseErrorMessage(new Error("boom"))).toBe("boom");
  });

  it("unwraps a JSON body's string message", () => {
    expect(parseErrorMessage(new Error('{"message":"quote expired"}'))).toBe(
      "quote expired",
    );
  });

  it("unwraps a JSON body's string error", () => {
    expect(parseErrorMessage(new Error('{"error":"bad chain"}'))).toBe(
      "bad chain",
    );
  });

  it("unwraps a nested error.message", () => {
    expect(
      parseErrorMessage(new Error('{"error":{"message":"no liquidity"}}')),
    ).toBe("no liquidity");
  });

  // Regression: a structured `message` used to be returned as-is, so the
  // caller stringified it to the literal "[object Object]" — 5 of the 27
  // our-side failures in the 2026-09-03..09 window reported exactly that.
  it("never returns a non-string for a structured message", () => {
    const out = parseErrorMessage(
      new Error('{"message":{"code":422,"detail":"unsupported source"}}'),
    );
    expect(typeof out).toBe("string");
    expect(out).not.toBe("[object Object]");
    expect(out).toContain("unsupported source");
  });

  it("never returns a non-string for a structured error.message", () => {
    const out = parseErrorMessage(
      new Error('{"error":{"message":{"reason":"stellar down"}}}'),
    );
    expect(typeof out).toBe("string");
    expect(out).not.toBe("[object Object]");
    expect(out).toContain("stellar down");
  });

  it("falls back to the raw text when the body has no message or error", () => {
    expect(parseErrorMessage(new Error('{"ok":false}'))).toBe('{"ok":false}');
  });
});

describe("createPaymentFailureError", () => {
  // Regression: call sites used to throw a bare "Failed to create Rozo
  // payment", discarding the message handleCreateRozoPayment had already
  // dispatched. 14 of 27 our-side failures reached telemetry as that bare
  // string, all on Stellar, with no way to tell what the API rejected.
  it("carries the message the store already holds", () => {
    const store = {
      getState: () => ({ type: "error", message: "source token not supported" }),
    };
    expect(createPaymentFailureError(store).message).toBe(
      "Failed to create Rozo payment: source token not supported",
    );
  });

  it("stringifies a structured store message instead of losing it", () => {
    const store = { getState: () => ({ message: { code: 500 } }) };
    const out = createPaymentFailureError(store).message;
    expect(out).not.toContain("[object Object]");
    expect(out).toContain("500");
  });

  it("says so explicitly when the store holds no detail", () => {
    const store = { getState: () => ({ type: "idle" }) };
    expect(createPaymentFailureError(store).message).toBe(
      "Failed to create Rozo payment (API reported no error detail)",
    );
  });

  it("treats a blank message as no detail", () => {
    const store = { getState: () => ({ message: "   " }) };
    expect(createPaymentFailureError(store).message).toBe(
      "Failed to create Rozo payment (API reported no error detail)",
    );
  });

  it("never lets an unreadable store mask the failure", () => {
    const store = {
      getState: () => {
        throw new Error("store exploded");
      },
    };
    expect(createPaymentFailureError(store).message).toBe(
      "Failed to create Rozo payment (API reported no error detail)",
    );
    expect(createPaymentFailureError(undefined).message).toBe(
      "Failed to create Rozo payment (API reported no error detail)",
    );
  });
});
