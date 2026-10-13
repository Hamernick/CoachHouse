# Floating Find dock

Replace the embedded home Find/Collect tab row and inline search with a fixed bottom dock. Keep the map and directory mounted in place. The dock uses the existing search component, a Collected button with the existing compact count animation, and the viewer avatar (guest fallback links to sign-in).

Collected opens an upward shadcn Popover with Command search and a bounded, scrollable saved-items list. Selecting an organization/resource/guide closes the menu and uses the existing detail/guide callback. Saving continues through existing local/authenticated preferences; no duplicate storage or new database writes. Include loading/unavailable and empty states.

Retain keyboard search, Escape, focus return, reduced motion, mobile safe-area and virtual-keyboard clearance. Add bottom content clearance so the fixed dock does not obscure the footer. Standalone /map retains its existing rail. Validate desktop/mobile dock positioning, collection search/selection, persistence after reload, keyboard dismissal and map instance stability. User reviews the visual direction locally; no deployment in this task.
