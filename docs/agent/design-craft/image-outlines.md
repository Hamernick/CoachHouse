# Image Outlines

Images can disappear into nearby surfaces when their outer pixels have similar
colors. Paint a faint edge inside the image so its geometry remains visible.

## Agent rules

- Prefer a one-pixel inset outline or inset shadow over a border. It must not
  change layout or image dimensions.
- Start near black at 10% in light mode and white at 10% in dark mode. Keep the
  practical range between 5% and 20%.
- Apply the treatment to thumbnails, logos, and avatars, including circular
  media.
- Preserve the image radius and place the edge over the outermost pixels.

```html
<img
  class="rounded-lg outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10"
/>
```

## Source notes

The source demonstrates the same pale image with and without an inset edge.
The treatment should be faint enough that the viewer notices the image shape,
not a decorative frame. This matters especially for avatars, pale logos, and
photos with white skies or walls.

A normal `border` participates in box sizing between padding and margin. An
`outline` with a negative offset, or an inset `box-shadow`, paints over the
outermost image pixels and leaves layout unchanged. Roughly 10% opacity is the
starting point: below 5% often disappears, while above 20% begins to read as a
visible frame.

[Open the interactive image and avatar comparisons](https://craft.gustavofior.com/image-outlines).

The source also gives this plain CSS equivalent:

```css
img {
  border-radius: 8px;
  outline: 1px solid rgb(0 0 0 / 0.1);
  outline-offset: -1px;
}

.dark img {
  outline-color: rgb(255 255 255 / 0.1);
}
```

## Coach House application

- Keep the outline on the media element, not on a wrapper that changes its
  measured size.
- Use theme-aware outline colors and preserve the media's existing radius.
- Inspect real light and dark imagery; do not raise opacity globally to solve
  one unusually pale asset.

## Resources

- [Details that make interfaces feel better](https://jakub.kr/writing/details-that-make-interfaces-feel-better)
  — Jakub Krehel's collection of small interface details, including inset
  image outlines.
- [`outline-offset`](https://developer.mozilla.org/en-US/docs/Web/CSS/outline-offset)
  — moves an outline inside the image box when negative.
- [`box-shadow`](https://developer.mozilla.org/en-US/docs/Web/CSS/box-shadow)
  — the inset alternative, including rounded-corner support.
- [`color-mix()`](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/color-mix)
  — can derive an adaptive edge color from the current theme.

Source: [Image Outlines](https://craft.gustavofior.com/image-outlines), Gustavo
Fior, published 2026-07-15. Explanation and examples above are paraphrased from
that source; the Coach House application is repository-specific.
