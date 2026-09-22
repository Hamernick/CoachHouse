# Nested Border Radius

Nested corners should share a visual center.

## Agent rules

Use this relationship as the starting point:

> inner radius = outer radius - inset

Include padding and intervening border width in the inset. Clamp the result at
zero, then tune by eye when edges do not have equal spacing or use different
corner shapes.

Example: a card with a 16px outer radius and an 8px inset should start with an
8px media radius.

## Source notes

Using the same radius for nested surfaces widens the visible gap around the
corner. Concentric corners instead share a visual center:

> outer radius = inner radius + inset

The inset is the distance between the two visible edges, usually parent padding
plus any intervening border. The source demonstration uses a 16px inner radius
and 12px inset, producing a 28px outer radius. When a design system starts from
the outer component, reverse the formula:

> inner radius = outer radius - inset

For example, a 32px outer radius with a 12px inset yields a 20px inner radius.
Clamp negative results to zero; if padding exceeds the outer radius, the inner
corner should be square.

The source's component comparison also uses a 16px card with an 8px inset and
8px media radius, plus a 12px menu with a 4px inset and 8px highlighted-item
radius.

[Open the interactive diagrams and component comparison](https://craft.gustavofior.com/nested-border-radius).

```css
.card-media {
  border-radius: max(0px, calc(var(--card-radius) - var(--card-inset)));
}
```

## Coach House application

- Include padding and border width when measuring the inset between visible
  curves.
- Use the equation as the initial token relationship, then inspect actual
  pixels. Adjust when insets differ by side, the child does not reach the
  corner, or the two surfaces use different corner shapes.
- Keep outer and inner radii adjacent in component code or tokens so their
  relationship survives later spacing changes.

## Resources

- [The math behind nesting rounded corners](https://cloudfour.com/thinks/the-math-behind-nesting-rounded-corners/)
  — practical derivation and CSS examples.
- [`border-radius`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/border-radius)
  — MDN property reference.
- [CSS corner shaping](https://www.w3.org/TR/css-backgrounds-3/#corners) — how
  outer, padding, and content edge radii relate.

Source: [Nested Border Radius](https://craft.gustavofior.com/nested-border-radius),
Gustavo Fior, published 2026-07-14. Explanation and examples above are
paraphrased from that source; the Coach House application is
repository-specific.
