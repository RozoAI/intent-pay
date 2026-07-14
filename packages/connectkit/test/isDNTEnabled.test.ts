import { test } from "node:test";
import assert from "node:assert/strict";
import { isDNTEnabled } from "../src/utils/isDNTEnabled.ts";

// SSR regression guard — invoice.rozo.ai incident 2026-07-13.
// Under SSR (Next.js/Node), `window` is undefined. Previously isDNTEnabled()
// touched `window.doNotTrack` unconditionally and threw ReferenceError,
// bubbling up to an HTTP 500 for the entire checkout page.
test("isDNTEnabled: no `window` — returns false without throwing", () => {
  assert.equal(typeof (globalThis as any).window, "undefined");
  assert.equal(isDNTEnabled(), false);
  assert.equal(typeof isDNTEnabled(), "boolean");
});

// Confirm the SSR failure mode is real: an implementation that skips the
// window guard throws ReferenceError. Without this, the guard test could
// pass on a runtime that no-ops undefined access and we'd never notice.
test("pre-fix shape (no window guard) throws ReferenceError — proves the regression", () => {
  const buggy = (): boolean => {
    if (typeof navigator === "undefined") return false;
    return (
      (navigator as any).doNotTrack === "1" ||
      (navigator as any).msDoNotTrack === "1" ||
      // @ts-expect-error — intentionally referencing undeclared `window`
      window.doNotTrack === "1"
    );
  };
  assert.throws(buggy, /window is not defined/);
});
