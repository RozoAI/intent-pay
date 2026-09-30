import { describe, expect, it } from "vitest";
import { createStore, waitForState } from "../src/stateStore.js";

describe("waitForState abort", () => {
  it("rejects when signal aborts before matching state", async () => {
    const store = createStore((state: number, _event: number) => state, 0);
    const controller = new AbortController();

    const promise = waitForState(
      store,
      (s): s is number => s === 1,
      undefined,
      undefined,
      { signal: controller.signal },
    );

    controller.abort();

    await expect(promise).rejects.toMatchObject({ name: "AbortError" });

    expect(() => store.dispatch(1)).not.toThrow();
  });
});
