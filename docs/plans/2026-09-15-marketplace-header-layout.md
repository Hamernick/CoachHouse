# Marketplace header and filters

## Approved direction

User supplied a color-library layout and coss.com component-library screenshots: prominent heading, short subtitle, compact categories, searchable filters, removable selections, and an aligned resource grid. Implement on the existing Profile branch and keep root localhost synchronized. Release hold remains in effect.

## Implementation

- Keep the Documentation shell, Marketplace resources/People views, existing catalog and cards.
- Increase the Marketplace heading and shorten its subtitle.
- Put resource search and a searchable filter menu before the results; replace the four large selects with category pills and removable filter chips.
- Retain category, purpose, stage and access predicates and URL state, shortlist storage/export, and the Ad Grants feature (after results).
- Use existing shadcn InputGroup, ToggleGroup, Popover and Command primitives; preserve keyboard navigation, labels, mobile touch targets and both themes.

## Validation

Targeted acceptance/lint, live Bandto localhost desktop/mobile filter selection/removal/reload/People navigation, and hosted checks. No local full build, full suite, Graphify refresh or additional server.
