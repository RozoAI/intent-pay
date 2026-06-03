# Product

## Register

product

## Users

Developers integrating the `@rozoai/intent-pay` SDK into their apps. They are comfortable with React and TypeScript. Their context when using the playground: evaluating the SDK, debugging payment flows, copying code snippets, and understanding the three integration modes (Bridge, Online Checkout, Wallet Deposit). They are time-constrained and need fast signal — "does this do what I need, and how do I wire it up?"

## Product Purpose

The Rozo Pay Playground is an interactive developer sandbox for the `@rozoai/intent-pay` SDK. It lets developers configure payment parameters, trigger live payment flows, observe SDK events, and copy production-ready code snippets — all without setting up their own project first. Success looks like: developer understands which integration mode fits their use case, has a working code snippet, and is confident enough to integrate.

## Brand Personality

Technical, minimal, trustworthy. The playground should feel like a well-engineered developer tool: precise, fast, no decoration for its own sake. Confidence comes from correctness and clarity, not visual flair. The SDK is serious infrastructure; the playground should reflect that.

## Anti-references

- **Not: generic SaaS cream/dashboard** — no off-white warm neutrals, no Stripe-clone blue-on-cream aesthetic, no visual language that reads as "another B2B tool."
- **Not: crypto hype** — no dark-mode neon glows, no purple gradient hero sections, no "DeFi" visual vocabulary.
- **Not: toy playground** — CodePen/JSFiddle pastel multi-pane aesthetics. This is production tooling, not a learning toy.

## Design Principles

1. **Precision over decoration.** Every visual element earns its place by communicating something — hierarchy, state, structure, or feedback. Remove if it doesn't communicate.
2. **Developer trust through correctness.** Code snippets, event logs, and state labels must be accurate and legible. A broken or unclear code example destroys trust faster than any visual failure.
3. **Clarity at a glance.** A developer landing on any mode page should immediately understand: what this mode does, what to configure, and what to expect. No orientation required.
4. **Density without clutter.** Developer tools earn compact layouts. Information-rich is good; visually noisy is not. Whitespace creates hierarchy, not emptiness.
5. **Dark mode is the native environment.** The playground ships dark by default — developer tools live in dark environments. Dark mode is not a feature; it is the primary surface.

## Accessibility & Inclusion

- WCAG 2.1 AA minimum. Code text (mono) must hit ≥4.5:1 against its background.
- Support reduced motion for any transitions or animations.
- Keyboard-navigable mode tabs and forms.
