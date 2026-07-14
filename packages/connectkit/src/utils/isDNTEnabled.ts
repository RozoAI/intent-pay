/**
 * Returns true when the browser signals Do Not Track.
 *
 * SSR-safe: Node/edge runtimes may define `navigator` globally (Node 21+ has
 * `globalThis.navigator`) but not `window`. Touching `window.doNotTrack`
 * without both guards throws `ReferenceError: window is not defined` at
 * render time — see invoice.rozo.ai SSR incident, 2026-07-13.
 */
export function isDNTEnabled(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }
  return (
    navigator.doNotTrack === "1" ||
    (navigator as any).msDoNotTrack === "1" ||
    (window as any).doNotTrack === "1"
  );
}
