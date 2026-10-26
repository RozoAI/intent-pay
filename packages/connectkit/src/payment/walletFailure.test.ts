import { describe, expect, it } from "vitest";

import {
  classifyPayerCode,
  classifyWalletFailure,
  PAY_ANOTHER_WAY_PRIMARY_AFTER_FAILURES,
  shouldPromotePayAnotherWay,
  walletFailureMessage,
  walletFailureTitle,
} from "./walletFailure";

/** Shape viem produces when a wallet answers eth_sendTransaction with -32603. */
function viemWrappedInternalError() {
  const rpc = Object.assign(new Error("Unexpected error"), {
    code: -32603,
    details: "Unexpected error",
  });
  const reverted = Object.assign(
    new Error(
      'The contract function "transfer" reverted with the following reason:\nUnexpected error',
    ),
    { name: "ContractFunctionRevertedError", cause: rpc },
  );
  return Object.assign(
    new Error(
      'The contract function "transfer" reverted with the following reason:\nUnexpected error\n\nContract Call:\n  function: transfer(address recipient, uint256 amount)\n\nVersion: viem@2.52.2',
    ),
    {
      name: "ContractFunctionExecutionError",
      shortMessage:
        'The contract function "transfer" reverted with the following reason:\nUnexpected error',
      cause: reverted,
    },
  );
}

describe("classifyWalletFailure", () => {
  // Regression for the 2026-10-26 Phantom EIP-7702 case: the text looks like
  // an on-chain revert but the chain carries a JSON-RPC internal error.
  it("reads a viem-wrapped -32603 as wallet_internal, not a revert", () => {
    const f = classifyWalletFailure(viemWrappedInternalError());
    expect(f.kind).toBe("wallet_internal");
    expect(f.rpcCode).toBe(-32603);
    expect(f.message).toContain("Unexpected error");
  });

  it("matches 'Unexpected error' text even without a code", () => {
    expect(classifyWalletFailure(new Error("Unexpected error")).kind).toBe("wallet_internal");
  });

  it("does not treat 'unexpectedly' or 'expected error' as wallet_internal", () => {
    expect(classifyWalletFailure(new Error("Request ended unexpectedly")).kind).toBe("other");
    expect(classifyWalletFailure(new Error("expected error here")).kind).toBe("other");
  });

  it("reads EIP-1193 4001 and rejection text as user_rejected", () => {
    expect(
      classifyWalletFailure(Object.assign(new Error("User rejected the request."), { code: 4001 }))
        .kind,
    ).toBe("user_rejected");
    expect(classifyWalletFailure({ code: -3, message: "User rejected" }).kind).toBe(
      "user_rejected",
    );
    // A rejection nested under a viem wrapper is still a rejection.
    const wrapped = Object.assign(new Error("Transaction failed"), {
      cause: Object.assign(new Error("User denied transaction signature"), { code: 4001 }),
    });
    expect(classifyWalletFailure(wrapped).kind).toBe("user_rejected");
  });

  it("leaves everything else as other, keeping the message", () => {
    const f = classifyWalletFailure(new Error("insufficient funds for gas"));
    expect(f.kind).toBe("other");
    expect(f.rpcCode).toBeNull();
    expect(f.message).toBe("insufficient funds for gas");
  });

  it("survives non-Error inputs and cyclic causes", () => {
    expect(classifyWalletFailure(undefined).message).toBe("unknown_error");
    expect(classifyWalletFailure("plain").message).toBe("plain");
    const a: { message: string; cause?: unknown } = { message: "a" };
    const b = { message: "b", cause: a };
    a.cause = b;
    expect(classifyWalletFailure(a).kind).toBe("other");
  });
});

describe("classifyPayerCode", () => {
  it("labels empty code as eoa, 0xef0100 as eip7702, other code as contract", () => {
    expect(classifyPayerCode("0x")).toBe("eoa");
    expect(classifyPayerCode(null)).toBe("eoa");
    expect(classifyPayerCode("0xef010069007702764179f14f51cdce752f4f775d74e139")).toBe("eip7702");
    expect(classifyPayerCode("0xEF0100aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")).toBe("eip7702");
    expect(classifyPayerCode("0x363d3d373d3d3d363d73")).toBe("contract");
  });

  it("labels a failed read as unknown, never as eoa", () => {
    expect(classifyPayerCode(undefined)).toBe("unknown");
  });
});

describe("shouldPromotePayAnotherWay", () => {
  it("promotes immediately on a wallet-internal failure", () => {
    expect(shouldPromotePayAnotherWay(classifyWalletFailure(viemWrappedInternalError()), 1)).toBe(
      true,
    );
  });

  it("keeps Retry first for the first other failure, promotes at the threshold", () => {
    const other = classifyWalletFailure(new Error("boom"));
    expect(shouldPromotePayAnotherWay(other, 1)).toBe(false);
    expect(shouldPromotePayAnotherWay(other, PAY_ANOTHER_WAY_PRIMARY_AFTER_FAILURES)).toBe(true);
    expect(shouldPromotePayAnotherWay(null, PAY_ANOTHER_WAY_PRIMARY_AFTER_FAILURES)).toBe(true);
  });
});

describe("copy", () => {
  it("names the wallet and never echoes the raw viem text", () => {
    const f = classifyWalletFailure(viemWrappedInternalError());
    const msg = walletFailureMessage(f, "Phantom");
    expect(msg).toContain("Phantom returned an internal error");
    expect(msg).not.toContain("contract function");
    // Never promise the payer that nothing was broadcast; we cannot know that.
    expect(msg?.toLowerCase()).not.toContain("nothing was charged");
    expect(msg).toContain("wait for it to confirm");
    expect(walletFailureTitle(f)).toBe("Wallet Could Not Send");
  });

  it("falls back to 'Your wallet' and stays silent for user rejections", () => {
    expect(walletFailureMessage(classifyWalletFailure(new Error("x")), "")).toContain(
      "Your wallet did not complete",
    );
    expect(
      walletFailureMessage(classifyWalletFailure({ code: 4001, message: "User rejected" })),
    ).toBeNull();
    expect(walletFailureTitle(null)).toBeNull();
  });
});
