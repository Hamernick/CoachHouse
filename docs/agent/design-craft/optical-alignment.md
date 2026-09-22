# Optical Alignment

Geometric centering is a starting point. Different icon and letter shapes carry
their visual weight in different places.

## Agent rules

- Check icon and text lockups by eye after geometric alignment.
- Use a specific one-pixel adjustment when a shape looks off-center. Do not add
  a global nudge for unrelated icons.
- Account for the empty space inside an icon box when setting button padding.
- Keep `font-optical-sizing: auto` unless a deliberate type treatment requires
  another setting.
- For opening punctuation, use hanging punctuation or a measured negative
  indent when browser support requires it.

## Source notes

The source compares geometric and optical alignment for play, star, and
download icons. A right-pointing triangle often needs a small horizontal shift;
stars and download marks may need a slight upward shift. These are per-shape
decisions, not a universal transform.

A practical test is to blur the icon heavily in developer tools or squint at
it. The outline disappears into a soft mass, revealing where the visual weight
actually sits. Nudge that mass toward the control's visual center.

Icon boxes also contain internal air. Equal CSS padding can therefore make the
icon side of a text button look wider; reduce padding on that side when the
rendered weight calls for it. Circles and triangles may also need to be slightly
larger than squares drawn in the same box.

Typography has comparable optical behavior. Keep variable-font optical sizing
enabled so text and display sizes use appropriate stroke and spacing designs.
Opening quotation marks are mostly whitespace, so let them hang into the margin
when possible.

[Open the interactive icon, shape, type, and quote comparisons](https://craft.gustavofior.com/optical-alignment).

```tsx
<button className="grid size-12 place-items-center rounded-full">
  <PlayIcon className="size-5 translate-x-px" />
</button>

<blockquote className="indent-[-0.42em]">
  “Good design is as little design as possible.”
</blockquote>
```

```css
blockquote {
  hanging-punctuation: first;
}

@supports not (hanging-punctuation: first) {
  blockquote {
    text-indent: -0.42em;
  }
}
```

## Coach House application

- Apply transforms to the individual glyph or icon, never to a shared button
  primitive unless every consumer has the same visual-weight problem.
- Record intentional nudges in the component class so later normalization does
  not erase them as apparent one-pixel mistakes.
- Verify the result at actual rendered size in both themes and at browser zoom.

## Resources

- [Apple Human Interface Guidelines: Icons](https://developer.apple.com/design/human-interface-guidelines/icons)
  — optical balance within icon bounding shapes.
- [Details that make interfaces feel better](https://jakub.kr/writing/details-that-make-interfaces-feel-better)
  — additional small optical adjustments.
- [CSS inline specification: `hanging-punctuation`](https://www.w3.org/TR/css-inline-3/#hanging-punctuation-property)
  — standards behavior for hanging opening marks.
- [Inter features](https://rsms.me/inter/#features) — what the optical-size axis
  changes across text sizes.

Source: [Optical Alignment](https://craft.gustavofior.com/optical-alignment),
Gustavo Fior, published 2026-07-15. Explanation and examples above are
paraphrased from that source; the Coach House application is
repository-specific.
