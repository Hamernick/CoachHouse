# UI Quality Rubric (MUST/SHOULD/NEVER)

Use this as the canonical UI implementation/review checklist.

Apply the focused craft references in [`design-craft/README.md`](design-craft/README.md)
for image edges, optical alignment, nested radii, and frequent interactions.

## Design Source

- MUST: For UI-visible work, read `docs/design.md` before editing and use it as the product-specific visual source of truth.
- MUST: Prefer `docs/design.md` when it is more specific than generic UI inspiration, while still preserving accessibility, security, responsive behavior, and shadcn/ui conventions.
- SHOULD: Mention the relevant `docs/design.md` guidance in the current monthly log linked from `docs/RUNLOG.md` for meaningful UI changes.

## Interactions

### Keyboard

- MUST: Full keyboard support per WAI-ARIA APG.
- MUST: Visible focus rings (`:focus-visible`; group with `:focus-within`).
- MUST: Manage focus (trap, move, return) per APG patterns.
- NEVER: `outline: none` without a visible replacement.

### Targets And Input

- MUST: Hit target >=24px (mobile >=44px); expand hit area if visual target is smaller.
- MUST: Mobile input font-size >=16px (prevent iOS zoom).
- NEVER: Disable browser zoom (`user-scalable=no`, `maximum-scale=1`).
- MUST: `touch-action: manipulation`.
- SHOULD: Align `-webkit-tap-highlight-color` with design.

### Forms

- MUST: Hydration-safe inputs (no lost focus/value).
- NEVER: Block paste in `input`/`textarea`.
- MUST: Loading buttons keep the original label and add spinner.
- MUST: Enter submits focused input; in `textarea`, Cmd/Ctrl+Enter submits.
- MUST: Submit remains enabled until request starts, then disables with spinner.
- MUST: Accept free text first, validate after (do not block typing).
- MUST: Allow incomplete submit attempts so validation can surface.
- MUST: Show inline errors and focus first invalid field on submit.
- MUST: Correct `autocomplete`, `name`, `type`, and `inputmode`.
- SHOULD: Disable spellcheck for emails/codes/usernames.
- SHOULD: Placeholders end with `…` and show example pattern.
- MUST: Warn on unsaved changes before navigation.
- MUST: Support password managers and 2FA paste.
- MUST: Trim trailing spaces from user inputs.
- MUST: No dead zones on checkbox/radio controls.

### State And Navigation

- MUST: URL reflects state (filters/tabs/pagination/expanded panels).
- MUST: Back/Forward restores scroll position.
- MUST: Use `a`/`Link` for navigation to preserve standard browser behavior.
- NEVER: Use `div onClick` for navigation.

### Feedback

- SHOULD: Use optimistic UI with reconciliation and rollback/undo on failure.
- MUST: Confirm destructive actions or provide an undo window.
- MUST: Use polite `aria-live` for toasts/validation.
- SHOULD: Use ellipsis `…` for actions that open follow-up work and for loading labels.

### Touch And Drag

- MUST: Keep targets generous with explicit affordances.
- MUST: Delay first tooltip; subsequent peer tooltips can be immediate.
- MUST: Use `overscroll-behavior: contain` in modals/drawers.
- MUST: During drag, disable text selection and set dragged elements `inert`.
- MUST: If it looks clickable, it is clickable.

### Autofocus

- SHOULD: Autofocus only for clear desktop-first single-input flows; rare on mobile.

## Animation

- MUST: Respect `prefers-reduced-motion`.
- SHOULD: Prefer CSS, then Web Animations API, then JS libraries.
- MUST: Animate only `transform`/`opacity`.
- NEVER: Animate layout properties (`top`, `left`, `width`, `height`).
- NEVER: Use `transition: all`.
- SHOULD: Animate only when clarifying causality or adding deliberate delight.
- SHOULD: Match easing to distance/size/trigger.
- MUST: Animations are interruptible and input-driven.
- MUST: Set correct `transform-origin`.
- MUST: For SVG transforms, use a `g` wrapper and `transform-box: fill-box`.

## Layout

- SHOULD: Prefer optical alignment over strict geometry when needed.
- MUST: Align deliberately to grid/baseline/edges.
- SHOULD: Balance icon/text lockups (weight/size/spacing/color).
- MUST: Verify on mobile, laptop, and ultra-wide (simulate ultra-wide at 50% zoom).
- MUST: Respect safe areas (`env(safe-area-inset-*)`).
- MUST: Eliminate unwanted scrollbars/overflow.
- SHOULD: Prefer flex/grid over JS measurement for layout.
- MUST: Follow `docs/design.md` text grouping: 4px eyebrow/title/subtitle gaps, 8px before related content, and 16px between sections. Use the feature's existing heading group instead of accumulating child margins.
- NEVER: Use section-sized margins (`mt-3` or larger) between a title and its subtitle, or stack parent gaps with child vertical margins/padding. Inspect computed spacing and wrapped lines before handoff.

## Content And Accessibility

- SHOULD: Prefer inline help over tooltips.
- MUST: Skeletons mirror final layout to minimize shift.
- MUST: `title` reflects current context.
- MUST: No dead ends; always offer recovery/next actions.
- MUST: Explicitly design empty/sparse/dense/error states.
- SHOULD: Use curly quotes and avoid widows/orphans (`text-wrap: balance`) where appropriate.
- MUST: Use `font-variant-numeric: tabular-nums` for comparable numbers.
- MUST: Never rely on color alone for status.
- MUST: Ensure accessible names even when labels are visually hidden.
- MUST: Use `…` character, not `...`.
- MUST: Provide heading hierarchy, skip links, and `scroll-margin-top` for heading anchors.
- MUST: Handle short/average/very long user-generated content.
- MUST: Use locale-aware dates/times/numbers (`Intl.*`).
- MUST: Accurate `aria-label`; decorative elements are `aria-hidden`.
- MUST: Icon-only buttons include descriptive `aria-label`.
- MUST: Prefer native semantics before ARIA.
- MUST: Use non-breaking spaces for coupled tokens (`10&nbsp;MB`, `⌘&nbsp;K`, brand names).

## Content Handling

- MUST: Ensure long text wraps/truncates cleanly (`truncate`, `line-clamp-*`, `break-words`).
- MUST: Set `min-w-0` on flex children that need truncation.
- MUST: Empty strings/arrays never break UI.

## Performance

- SHOULD: Test in iOS Low Power Mode and Safari.
- MUST: Measure under reliable conditions (disable runtime-skewing extensions).
- MUST: Track/minimize re-renders with React profiling tools.
- MUST: Profile with CPU and network throttling.
- MUST: Batch layout reads/writes to avoid reflow thrash.
- MUST: Target <500ms mutations (`POST`, `PATCH`, `DELETE`) for normal paths.
- SHOULD: Prefer uncontrolled inputs where practical.
- MUST: Virtualize long lists (>50 items).
- MUST: Preload above-the-fold images; lazy-load the rest.
- MUST: Prevent CLS with explicit image dimensions.
- SHOULD: Preconnect to CDN domains.
- SHOULD: Preload critical fonts with `font-display: swap`.

## Dark Mode And Theming

- MUST: Set `color-scheme: dark` on `html` for dark mode.
- SHOULD: Keep `meta[name='theme-color']` aligned with page background.
- MUST: Native `select` controls set explicit `background-color` and `color`.

## Hydration

- MUST: Inputs with `value` include `onChange` (or use `defaultValue`).
- SHOULD: Guard date/time rendering against hydration mismatch.

## Design

- SHOULD: Prefer layered shadows (ambient + direct).
- SHOULD: Use semi-transparent borders plus shadows for edge crispness.
- SHOULD: Nested radii are concentric (child <= parent).
- SHOULD: Keep hue consistency between bg/border/shadow/text.
- MUST: Charts use color-blind-safe palettes.
- MUST: Meet contrast requirements (prefer APCA guidance).
- MUST: Increase contrast on `:hover`, `:active`, `:focus`.
- SHOULD: Match browser UI chrome to page background.
- SHOULD: Avoid gradient banding in dark themes.
