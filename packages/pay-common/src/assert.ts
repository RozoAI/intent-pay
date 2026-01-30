import { debugJson } from "./debug";

/**
 * Checks if the given condition is true, otherwise throws an error with a message.
 *
 * @param condition The condition to assert.
 * @param args Optional additional messages or a function returning a message.
 * @throws {Error} If the condition is falsy.
 *
 * @example
 * assert(x > 0, "x must be positive");
 *
 * @example
 * assert(isValid(), () => `Validation failed for input`);
 */
export function assert(condition: boolean, ...args: any[]): asserts condition {
  if (condition) return;
  let msg: string;
  if (args.length === 1 && typeof args[0] === "function") {
    msg = args[0]();
  } else {
    msg = args.map((a) => debugJson(a)).join(", ");
  }
  throw new Error("Assertion failed: " + msg);
}

/**
 * Asserts that the given value is neither null nor undefined.
 *
 * @param value The value to check.
 * @param args Optional additional messages or a function returning a message.
 * @returns The non-null, non-undefined value.
 * @throws {Error} If the value is null or undefined.
 *
 * @example
 * const val = assertNotNull(maybeVal, "Value must not be null");
 */
export function assertNotNull<T>(
  value: T | null | undefined,
  ...args: any[]
): T {
  assert(value !== null && value !== undefined, ...args);
  return value;
}

export function assertEqual<T>(a: T, b: T, ...args: any[]): void {
  assert(a === b, ...args);
}

/** Used to compile-time check that switch statements are exhaustive, etc. */
export function assertUnreachable(_: never): never {
  throw new Error("Unreachable");
}
