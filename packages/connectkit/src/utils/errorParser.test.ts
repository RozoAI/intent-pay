import { describe, expect, it } from "vitest";

import { parseErrorMessage } from "./errorParser";

describe("parseErrorMessage", () => {
  it("reads Error instances", () => {
    expect(parseErrorMessage(new Error("boom"))).toBe("boom");
  });

  it("passes strings through", () => {
    expect(parseErrorMessage("plain failure")).toBe("plain failure");
  });

  // Regression: wallet adapters reject with bare `{ code, message }` objects
  // that are not Error instances. Callers used to fall through to
  // String(error), which produced the literal "[object Object]" — in PostHog
  // that was the single largest payment_failure bucket, and because the string
  // does not contain "rejected" it also misclassified user cancellations as
  // hard failures and rendered "[object Object]" on the error screen.
  it("reads the message off a bare rejection object", () => {
    expect(parseErrorMessage({ code: -3, message: "User rejected" })).toBe(
      "User rejected",
    );
  });

  it("never returns the literal [object Object] for object rejections", () => {
    for (const rejection of [
      { code: -3, message: "User declined the request" },
      { code: 6, message: "Request expired. Please try again." },
      { message: "Wallet is locked" },
    ]) {
      expect(parseErrorMessage(rejection)).not.toBe("[object Object]");
    }
  });

  it("falls back for objects that carry no usable message", () => {
    expect(parseErrorMessage({ code: -3 })).toBe("Something bad happened");
    expect(parseErrorMessage(null)).toBe("Something bad happened");
  });
});
