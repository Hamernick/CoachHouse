# One Particle action menu

## Revised scope

The user reports Decision behavior seems fine but rejects its oversized UI and the investment in individual editors. Stop expanding individual Particle features; skip People, Metric and Finance editors. Forms are prototype UI only for now, with no response pipeline or data bindings. Skip the final interaction-review phase. Generative UI and performance profiling remain deferred.

## Implementation sequence

1. Replace canvas Particle remove/overflow/footer actions with one small circular ellipsis button overlapping the upper-right corner. Reveal on hover, focus or selection; keep visible while its menu is open and on touch. Use the existing shadcn menu and semantic tokens, rounded surfaces, no shadow and reduced-motion support.
2. Group Edit and Duplicate, Size and Lock/Unlock, then Remove from canvas. Keep meaningful content interactions inside each preview. Size is a Compact/Default/Wide submenu; height remains content-driven. No disabled placeholder Share action or extra persistent resize control.
3. Use the existing session and operations for duplication, width, lock and placement. Flush movement first; protect dirty drafts and serialize actions. Duplicate with fresh Particle/nested-record IDs, preserved source references, a nearby position, no copied rails and no automatic inspector opening. Existing undo receipts cover confirmed changes. Removal returns the existing record to the library with links retained.
4. Reuse the same overlay shell for existing workspace tools' return-to-library control, exposing only their supported action. Organization/Fiscal Sponsorship singleton records are not duplicated.
5. Focused operation/history/component checks, types, lint and relevant guards. No browser matrix, final interaction review or visual-baseline update in this slice, per user direction.

## Checkpoint

- Implemented shared `particle-menu-overlay.tsx`, domain `particle-action-menu.tsx`, operation helpers and guarded action hook. Simplified `particle-card.tsx`; wired actions through the existing flow. Existing tool remove controls reuse the overlay shell.
- 101 focused tests across five suites passed, including 16 new cases for one chrome button, duplication of all eight types, nested identity/reference handling, width/default/lock, hide-with-links, dirty/read-only/busy guards, serialized actions and history. Scoped TypeScript, changed ESLint, boundaries, thresholds, React Grab, interaction locks, workspace storage/surfaces, acceptance manifest and diff checks passed.
- No database, provider, form backend or generative changes. Port 3008 remains running; no restart. Appearance is not independently verified. Next shared capability: images/documents, followed by sharing, unified tool actions and saved-operation collaboration. Individual editor expansion and final interaction review are skipped.

## Image reference and corner correction

User moved the shared action button to the upper-right corner; align the popup to its right edge. For the upcoming image upload/paste/drop UI, follow the supplied `IMG_2606.PNG`: a large rounded image with a slim title row directly below, minimal framing, no date or extra metadata. Keep the shared corner action menu. Image implementation remains the next capability, not part of this positioning correction.
