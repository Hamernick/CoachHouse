# Calendar and mobile integration — September 15, 2026

## Result

Calendar uses the sidebar on mobile and the header on desktop. The mobile drawer
has a labelled 44px close control and an accessible description. It retains the
Calendar branch's selected-date/month state and overlay unmount behavior.

The sidebar header and shared Dialog/Sheet primitives come from the approved
Mobile direction at `ec0b73d4`. The primitives match that commit byte-for-byte.
Mobile dialogs retain left-aligned headings, 16px padding, rounded corners,
viewport-limited scrolling and 44px close targets. Desktop behavior stays in the
same shared primitives. These shared changes also apply to other dialogs/sheets;
the hosted full visual gate remains required before release.

## Visual references

Reviewed and updated only `google-calendar-setup-390-light.png` and
`google-calendar-setup-390-dark.png`. The prior references used centered headings,
24px padding and smaller close controls. The new references represent the
approved Mobile dialog, rather than a Calendar-specific redesign. Both originals
were backed up locally. Screenshot tolerances are unchanged.

Hosted run `35036477104` passed all nonvisual lanes and54 visual tests, leaving
these same two comparisons with3% text-rendering differences from macOS. Reviewed
each expected/actual/diff: dimensions358×570, control positions and line wrapping
match. Both Linux actuals are byte-identical to their retries. Added two Linux
counterparts through the existing reviewed-platform helper; macOS references and
the2% comparison tolerance remain unchanged. This separates platform rendering
without suppressing screenshot assertions.

## Validation

- 33 focused Calendar, service, Workspace Tools and shell acceptance tests pass.
- Four targeted browser tests pass against the existing combined localhost:
  mobile setup light/dark and mobile/desktop overlay closing/selection persistence.
- The mobile lifecycle regression now clicks the real close control and checks
  its minimum 44px width/height; later steps retain Escape dismissal coverage.
- Scoped lint, interaction-lock and React Grab ownership checks pass.
- Bandto Chrome: Menu → sidebar Calendar → setup → close setup → close Calendar
  returns to the sidebar. Existing connection settings were observed and left
  unchanged. No sync, consent, settings save, export or disconnect was performed.

The localhost check includes other preserved local work. Exact committed-branch
hosted quality is a separate gate. No production feature activation, provider
configuration, migration or release is part of this change.


## Final hosted result

Commit `6ce80db6`: [CI35036908856](https://github.com/Hamernick/coach-house-lms/actions/runs/35036908856) passes every quality lane.55 browser cases passed first attempt; one full-page390px light Calendar comparison passed on retry. The repaired setup references pass. The retry's actual/diff was not uploaded by the successful job, so its cause remains unverified. Both Preview deployments are Ready. Draft#237 remains open; production activation and release are held.
