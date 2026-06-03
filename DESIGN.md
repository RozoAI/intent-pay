---
name: Rozo Pay Playground
description: Interactive developer sandbox for the @rozoai/intent-pay SDK
colors:
  ink: "oklch(0.985 0 0)"
  ink-muted: "oklch(0.708 0 0)"
  ink-dim: "oklch(0.556 0 0)"
  surface-base: "oklch(0.145 0 0)"
  surface-raised: "oklch(0.205 0 0)"
  surface-subtle: "oklch(0.269 0 0)"
  surface-hover: "oklch(0.97 0 0)"
  border-default: "oklch(1 0 0 / 10%)"
  border-input: "oklch(1 0 0 / 15%)"
  destructive: "oklch(0.704 0.191 22.216)"
  event-started: "oklch(0.627 0.188 249)"
  event-completed: "oklch(0.696 0.176 151)"
  event-payout: "oklch(0.627 0.188 295)"
  code-bg: "oklch(0.12 0 0)"
typography:
  display:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "normal"
  body:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "normal"
  mono:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
rounded:
  sm: "0.375rem"
  md: "0.625rem"
  lg: "0.75rem"
  xl: "0.875rem"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.surface-hover}"
    textColor: "{colors.surface-raised}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface-base}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.md}"
    padding: "4px 8px"
  button-ghost-hover:
    backgroundColor: "oklch(1 0 0 / 10%)"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "4px 8px"
  input:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  card:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "24px"
  card-muted:
    backgroundColor: "oklch(0.205 0 0 / 50%)"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.xl}"
    padding: "16px 20px"
  tab-active:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "0"
    padding: "8px 16px"
  tab-inactive:
    backgroundColor: "transparent"
    textColor: "{colors.ink-dim}"
    rounded: "0"
    padding: "8px 16px"
---

# Design System: Rozo Pay Playground

## 1. Overview

**Creative North Star: "The Open Source Reference"**

The Rozo Pay Playground is built like a well-maintained open-source documentation site: information-dense but never noisy, dark by default, typographically precise. The atmosphere is that of GitHub's code view or Linear's issue tracker — familiar territory for any developer, instantly legible, with hierarchy earned entirely through lightness steps and weight contrast. No color is deployed decoratively; every chromatic element signals a specific state or category.

The system is monochromatic at its core. A pure achromatic dark palette — near-black ground, two gray surface levels, three foreground densities — carries all spatial hierarchy. Borders define surfaces rather than shadows; edges are visible but not loud. The only chromatic colors are semantic: destructive red for errors, and three distinct hues for SDK event badges (blue for `onPaymentStarted`, green for `onPaymentCompleted`, violet for `onPayoutCompleted`). These colors earn their use because they communicate, not because they decorate.

This system explicitly rejects the off-white warm-neutral dashboard aesthetic (Stripe-clone beige, generic B2B cream), the DeFi neon glow (dark purple with gradient accents), and the toylike multi-panel CodePen/JSFiddle aesthetic. The playground is production tooling, not a learning toy.

**Key Characteristics:**
- Near-black ground (#0d0d0d range) with two gray elevation levels
- Zero decorative color: all chroma is semantic
- Monospaced font (Geist Mono) carries technical identity
- Flat surfaces with border-based layering — no box-shadows
- Code blocks use VS Code dark theme for recognition and legibility
- Event badges are the only color "moments" on any screen

## 2. Colors: The Achromatic System

A pure zero-chroma palette where every distinction is a lightness step. Color appears only to communicate state.

### Primary (Foreground)
- **Full Ink** (`oklch(0.985 0 0)` / near-white): Primary text, active labels, heading text. The highest-contrast foreground.
- **Muted Ink** (`oklch(0.708 0 0)` / medium gray): Secondary text, captions, placeholder content, inactive tab labels. Must hit ≥4.5:1 against `surface-raised`.
- **Dim Ink** (`oklch(0.556 0 0)` / dark gray): Tertiary text, descriptive prose within cards. Use sparingly — verify contrast on each background it appears over.

### Neutral (Background + Surface)
- **Surface Base** (`oklch(0.145 0 0)` / near-black): Root page background. The lowest layer.
- **Surface Raised** (`oklch(0.205 0 0)` / dark gray): Cards, panels, modal backgrounds. One lightness step above base.
- **Surface Subtle** (`oklch(0.269 0 0)` / mid-dark gray): Inputs, secondary backgrounds, scroll areas, hover states on interactive rows.
- **Border Default** (`oklch(1 0 0 / 10%)`): Dividers, card edges, tab separators. Translucent white so it adapts to any surface it sits on.
- **Border Input** (`oklch(1 0 0 / 15%)`): Input field strokes. Slightly more visible than default borders.

### Semantic
- **Destructive** (`oklch(0.704 0.191 22.216)`): Errors, failure states, delete actions.
- **Event: Started** (`oklch(0.627 0.188 249)` / blue): `onPaymentStarted` badge. Technical, informational.
- **Event: Completed** (`oklch(0.696 0.176 151)` / green): `onPaymentCompleted` badge. Success.
- **Event: Payout** (`oklch(0.627 0.188 295)` / violet): `onPayoutCompleted` badge. Distinct from completed to distinguish settlement from confirmation.

### Named Rules
**The One Color Rule.** The only chromatic color on any given screen is semantic: an error state, a destructive action, or an SDK event badge. If you are adding a color for visual interest, remove it.

**The Badge Distinctness Rule.** The three event badge hues (blue / green / violet) must remain perceptually distinct at a glance. Never substitute one for another, never use any of these hues for non-event purposes, and never reduce their opacity so far that distinctness is lost.

## 3. Typography

**Body + UI Font:** Geist (system-ui fallback)
**Code + Mono Font:** Geist Mono (ui-monospace fallback)

**Character:** A single-family sans system where the only variation is weight (400 / 500 / 600) and the mono subfamily. Geist is geometric with technical warmth — not corporate, not playful. Geist Mono carries the technical identity of the playground: addresses, paymentIds, API payloads, and code snippets all render in mono.

### Hierarchy
- **Display** (600, 1rem / 16px, 1.4 lh): Page-level section headers, mode titles. Sparingly — most screens have one.
- **Body** (400, 0.875rem / 14px, 1.6 lh): Paragraph descriptions, mode summaries, form helper text. Cap line length at 65–75ch.
- **Label** (500, 0.75rem / 12px, 1.4 lh): Form labels, section eyebrows (when used), version badges, column headers. Small-caps or uppercase variants are prohibited.
- **Mono** (400, 0.75rem / 12px, 1.6 lh): Addresses, payment IDs, event payloads, chain values, any technical identifier. Geist Mono at 12px.
- **Code block** (400, 0.8rem / 12.8px, 1.6 lh): Syntax-highlighted code snippets rendered via Prism with vscDarkPlus theme.

### Named Rules
**The Mono Identity Rule.** Any value that a developer would copy-paste (address, token address, payment ID, amount in units, API endpoint) must render in `font-mono`. Do not render these values in the body sans-serif font, even at small sizes.

**The No Uppercase Body Rule.** Uppercase is reserved for `<code>` values (where casing is semantic) and explicit short badges. Never uppercase prose, descriptions, or form labels. The label "CONFIGURATION" as a section heading is prohibited; use "Configuration".

## 4. Elevation

This system is flat-by-default. Surfaces are distinguished by background lightness steps and border strokes, never by box-shadows. The three levels — `surface-base` → `surface-raised` → `surface-subtle` — are the only spatial tools.

Borders are translucent white (`oklch(1 0 0 / 10%)`), which means they appear slightly different on each background they overlay, naturally reinforcing the depth hierarchy without needing separate border color tokens per layer.

**No box-shadows anywhere.** Not on hover, not on focus, not on modals. The SDK's own payment modal (RozoPayButton) has its own shadow system outside this design system's scope; do not extend it into the playground UI.

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest and flat on interaction. Depth is communicated by background lightness and border presence. A `box-shadow` appearing anywhere in the playground stylesheet is a bug.

## 5. Components

### Buttons
Buttons are achromatic and weight-based. The primary action on a dark background uses a near-white fill with dark text — maximum contrast. Ghost variants use transparent backgrounds with border or text-only treatment.

- **Shape:** Gently curved (10px radius / `rounded-md`)
- **Primary:** Near-white background (`oklch(0.97 0 0)`), near-black text (`oklch(0.205 0 0)`). Padding 8px 16px.
- **Primary Hover:** Full white background, black text. `transition: background 150ms ease-out`.
- **Primary Disabled:** Opacity 0.4, `cursor: not-allowed`.
- **Ghost:** Transparent background, muted foreground text. Hover: `oklch(1 0 0 / 10%)` background.
- **Ghost Icon (size-icon):** 28×28px, transparent, `rounded-md`. Used for copy button in code blocks.
- **Size lg:** `min-w-44`, used for primary CTA buttons in preview panes.

### Inputs / Fields
Inputs use the secondary surface (`surface-raised`) as background, with a slightly more opaque border than default cards.

- **Style:** `surface-raised` background, `border-input` border (15% white), `rounded-md` (10px).
- **Focus:** Native focus ring via `outline-ring/50`. No custom glow.
- **Font:** Body font by default; addresses and amounts use `font-mono text-xs`.
- **Error:** `border-destructive` swap. Error message in `text-destructive text-sm` below the field.
- **Disabled:** Opacity 0.5.

### Select / Dropdown
- **Style:** Matches Input. Trigger: `surface-raised` background, `border-border`.
- **Content:** Popover floats above the page, `surface-raised` bg, `rounded-lg` (12px), `border-border` stroke.
- **Item Hover:** `surface-subtle` background.

### Cards / Containers
- **Corner Style:** Extra-rounded (14px / `rounded-xl`).
- **Background:** `surface-raised` for interactive cards; `surface-raised / 50%` (card-muted) for informational/description panels.
- **Border:** `border-default` stroke.
- **Padding:** 24px standard; 16px 20px for compact info cards.
- **Nested cards are prohibited.** The ModeDescription + PreviewPane pattern — description card above, preview card below — is the correct nesting limit. Do not add a card inside either of those.

### Tabs (PreviewPane: Preview / Code)
- **Style:** Underline tabs (2px bottom border), not pill tabs. Active: `border-foreground text-foreground`. Inactive: `border-transparent text-muted-foreground hover:text-foreground`.
- **Placement:** Above the content panel, flush to its top edge (`-mb-px` pull).
- **Tab bar background:** None. The nav sits on the page background, not in a container.

### Navigation (PlaygroundNav: Bridge / Online Checkout / Wallet Deposit)
- Same underline-tab pattern as PreviewPane tabs.
- **Active:** `border-foreground text-foreground`. Inactive: `border-transparent text-muted-foreground`.
- **Spacing:** `gap-1` between tabs, `px-4 py-2`.
- **Bottom border:** A full-width `border-b border-border` line grounds the nav.

### Event Log
A live-updating feed of SDK callback events. Each entry is a row: a colored badge (semantic hue) on the left, formatted JSON payload on the right in `font-mono text-xs text-muted-foreground`.

- **Container:** `ScrollArea` with `h-40` cap, `rounded-md`, `border-border`, `surface-subtle/50` background.
- **Badge:** Outlined, small (px-1.5 py-0.5), with per-event semantic color (blue/green/violet at 20% opacity background, 30% opacity border).
- **Empty state:** `text-xs text-muted-foreground` — "Events will appear here as you complete payment steps."

### Code Snippet
The code display component is distinct from the rest of the UI: it uses a hardcoded VS Code dark theme (`#1e1e1e` background) rather than the design system's surface tokens. This is intentional — developers recognize VS Code dark, and the contrast with the surrounding UI signals "this is code, not UI."

- **Background:** `#1e1e1e` (hardcoded, not a design token).
- **Copy button:** Ghost icon button (`h-7 w-7`, `hover:bg-white/10`), positioned `absolute top-2 right-2`.
- **Copied state:** Check icon in `text-green-400` for 2 seconds.
- **Font:** Geist Mono, 0.8rem, line numbers visible.

### ModeDescription Panel
An informational card that appears above each mode's layout explaining the integration pattern.

- **Background:** `card/50` (semi-transparent card surface).
- **Structure:** Title (display weight) + summary prose + step list + optional note.
- **Step badges:** Tiny filled circles (16×16px, `surface-subtle` bg, `text-foreground` number) + label in `text-muted-foreground`.
- **Note:** Separated by a top border, `text-xs text-muted-foreground`.

## 6. Do's and Don'ts

### Do:
- **Do** use `font-mono` for every technical identifier: addresses, payment IDs, token addresses, chain IDs, units values, API payloads.
- **Do** use lightness-step contrast alone to distinguish surfaces. `surface-base` → `surface-raised` → `surface-subtle` is the full vocabulary.
- **Do** keep semantic badge colors (blue/green/violet) exclusive to SDK event types. Never reuse them for navigation, labels, or decorative elements.
- **Do** verify that `ink-muted` (0.708 lightness) on `surface-raised` (0.205 lightness) clears ≥4.5:1 before using it for body text. If it doesn't, use `ink` instead.
- **Do** use `text-wrap: balance` on h1–h2 level headings and `text-wrap: pretty` on multi-line prose to prevent orphans.
- **Do** keep the code block's `#1e1e1e` / vscDarkPlus theme intact. Developer recognition of VS Code dark is a trust signal.
- **Do** support `prefers-reduced-motion`. Any transition longer than `150ms` must have a `@media (prefers-reduced-motion: reduce)` override.

### Don't:
- **Don't** use the cream/sand/beige neutral band for any background. The warm-neutral band (`oklch(0.84–0.97, chroma < 0.06, hue 40–100)`) is the generic SaaS aesthetic this system explicitly rejects.
- **Don't** add accent colors for visual interest. The One Color Rule is absolute: chromatic color appears only when it communicates state.
- **Don't** add `box-shadow` to playground surfaces. The Flat-By-Default Rule is absolute.
- **Don't** use neon, glow, or gradient effects. No `background-clip: text` gradient, no backdrop-filter glassmorphism, no vibrant DeFi-adjacent glow.
- **Don't** uppercase prose, descriptions, or form labels. Reserve uppercase for code values where casing is semantic.
- **Don't** nest cards. The two-level card structure (ModeDescription above PreviewPane) is the maximum depth.
- **Don't** use numbered section markers (01 / 02 / 03) as eyebrows on every section. The step list inside ModeDescription (steps 1–4) is a legitimate ordered sequence. Decorative numbered eyebrows on layout sections are not.
- **Don't** render body text in `ink-dim` (`oklch(0.556 0 0)`) on `surface-raised` (`oklch(0.205 0 0)`) without verifying contrast. This combination may fail 4.5:1.
