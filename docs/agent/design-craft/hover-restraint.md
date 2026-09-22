# Hover Restraint

Frequent interactions should track the pointer immediately.

## Agent rules

- Use instant hover state changes for navigation, catalog items, and repeated
  controls. Avoid opacity, color, or position delays that trail the pointer.
- Reserve motion for changes that explain cause and effect.
- Delay the first tooltip by roughly 400–700ms; nearby tooltips may then open
  immediately.
- Keep keyboard shortcuts and frequently toggled panels immediate.
- Honor reduced-motion preferences for any remaining animation.

## Source notes

Hover can fire across many items in a single pointer sweep. Repeated fades make
the interface trail behind the pointer even when each transition is short. The
source's governing idea is that interaction frequency determines how much
animation it can afford: frequent, intentional actions should respond
immediately.

Tooltips are the main exception. Delay the first tooltip so labels do not appear
while the pointer is merely passing through, then open neighboring tooltips
immediately once the user has shown intent.

The same frequency rule applies to keyboard actions. A shortcut user already
understands the result, so a frequently toggled sidebar or panel should not make
them wait for travel animation. A modal opened once per session can still use
motion when it explains origin, hierarchy, or cause and effect.

[Open the instant-hover, tooltip, and keyboard-action demonstrations](https://craft.gustavofior.com/hover-restraint).

```tsx
<button className="hover:bg-muted motion-reduce:transition-none">
  Immediate repeated action
</button>
```

The absence of a transition is intentional here. Add motion only when it
communicates state change rather than decorating pointer entry.

## Coach House application

- Keep navigation, catalog tiles, repeated controls, keyboard shortcuts, and
  frequently toggled panels immediate.
- Configure tooltip providers so the first open waits roughly 400–700ms and
  adjacent tooltips skip the repeated delay.
- Never make essential information hover-only; `:hover` is unreliable on touch
  and pen input.
- Test reduced motion and interruption before retaining any animation.

## Examples and resources

- [Raycast](https://www.raycast.com/) — launcher opening and closing without a
  transition.
- [Rauno Freiberg on interaction design](https://rauno.me/craft/interaction-design)
  — includes the instant macOS application switcher.
- [You don't need animations](https://emilkowal.ski/ui/you-dont-need-animations)
  — when motion helps and when hover animation gets in the way.
- [7 practical animation tips](https://emilkowal.ski/ui/7-practical-animation-tips)
  — includes tooltip timing guidance.
- [Base UI Tooltip](https://base-ui.com/react/components/tooltip) — delay and
  instant-neighbor behavior in a production primitive.
- [MDN `:hover`](https://developer.mozilla.org/en-US/docs/Web/CSS/:hover) —
  pointer and touch reliability constraints.

Source: [Hover Restraint](https://craft.gustavofior.com/hover-restraint), Gustavo
Fior, published 2026-07-15. Explanation and examples above are paraphrased from
that source; the Coach House application is repository-specific.
