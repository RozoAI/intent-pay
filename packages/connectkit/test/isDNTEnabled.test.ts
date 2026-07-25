import { describe, expect, it } from "vitest";
import { isDNTEnabled } from "../src/utils/isDNTEnabled.ts";

describe("isDNTEnabled", () => {
  // SSR regression guard — invoice.rozo.ai incident 2026-07-13.
  // Under SSR (Next.js/Node), `window` is undefined. Previously isDNTEnabled()
  // touched `window.doNotTrack` unconditionally and threw ReferenceError,
  // bubbling up to an HTTP 500 for the entire checkout page.
  it("no `window` — returns false without throwing", () => {
    expect(typeof (globalThis as any).window).toBe("undefined");
    expect(isDNTEnabled()).toBe(false);
    expect(typeof isDNTEnabled()).toBe("boolean");
  });

  // Confirm the SSR failure mode is real: an implementation that skips the
  // window guard throws ReferenceError. Without this, the guard test could
  // pass on a runtime that no-ops undefined access and we'd never notice.
  it("pre-fix shape (no window guard) throws ReferenceError — proves the regression", () => {
    const buggy = (): boolean => {
      if (typeof navigator === "undefined") return false;
      return (
        (navigator as any).doNotTrack === "1" ||
        (navigator as any).msDoNotTrack === "1" ||
        // @ts-expect-error — intentionally referencing undeclared `window`
        window.doNotTrack === "1"
      );
    };
    expect(buggy).toThrow(/window is not defined/);
  });
});
