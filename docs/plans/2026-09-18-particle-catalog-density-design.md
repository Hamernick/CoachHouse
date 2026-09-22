# Particle Catalog Density Design

## Problem

The Particles catalog uses four wide columns and a tall generic preview. Its
cards consume too much vertical space, repeat weak placeholder imagery, and are
cropped by the Workspace drawer without explaining that more content continues.

## Design

- Replace breakpoint-count columns with an auto-filling grid targeting compact
  11–13rem tiles and 10px gaps.
- Limit the catalog viewport to about two visible rows. Keep it independently
  scrollable and apply the shared content-aware bottom fade only while more
  content remains.
- Use real mini representations: organization artwork and metrics, current
  activity, roadmap artwork or document text, objective progress, Drive file
  identity, and uploaded images.
- Use a 14px card radius with a 10px inset preview radius. Give every image a
  one-pixel negative-offset outline at 10% theme-aware opacity.
- Keep catalog hover feedback immediate. Preserve keyboard add, drag/drop,
  touch targets, source availability, and existing canvas behavior.

## Validation

- Verify the authenticated Workspace drawer at desktop and narrow widths in
  light and dark mode.
- Confirm the fade appears only while the grid can scroll and clears at the end.
- Run focused Particles tests, scoped lint, structure, boundary, React Grab,
  Workspace-surface, raw-button, and visual checks.
