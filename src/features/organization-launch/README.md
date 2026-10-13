# OrganizationLaunch Feature

## Ownership
- Domain logic: `src/features/organization-launch/lib/**`
- Server actions/queries: `src/features/organization-launch/server/**`
- UI components: `src/features/organization-launch/components/**`
- Hooks/controllers: `src/features/organization-launch/hooks/**`

## Rules
- Keep route files in `src/app/**` as composition-only wrappers over this feature.
- Import other features only through their public entrypoint (`@/features/<name>`).
- Keep `lib/**` pure: no React, no UI imports, no route imports.
- Keep `server/**` free of UI/component imports.
- Keep shared UI in `src/components/ui/**`; avoid one-off primitives here.
- Keep acceptance coverage in `tests/acceptance/organization-launch.test.ts`.
- Add acceptance tests for user-visible behavior before merging.

## Scope

- A saved-profile checklist in the Workspace Accelerator overview, also available outside paid lesson access.
- Name/URL, a description, and explicit publication are shown separately from optional location/program enrichment. This is guidance, not a server authorization or eligibility policy.
- Checklist rows expand into inline name/URL, description, location, program and publication forms. Saves use the canonical Organization and Program actions, then refresh the saved profile data. Publication loads a fresh authenticated review and retains deliberate Publish profile / Make private controls with revision checks. A full preview link remains available.
- Public profile links require saved visibility and a saved slug. Location text does not assert a map pin or search indexing.
- Read-only viewers can inspect the profile without editor CTAs. The existing server owns write authorization.
- Draft preview at `/workspace/profile-preview` resolves the active organization and edit permission server-side. It shares the anonymous map projection and `PublicMapOrganizationDetail` renderer, and includes only explicitly public-marked programs.
- Review revisions cover the public projection, selected programs, organization version and saved visibility. Publication reloads the review, then the canonical write rechecks active organization and optimistic version. Error paths retain saved work.
- Map status distinguishes online, no address, unresolved location and saved coordinates; it never invents a pending geocoding job or claims search indexing was verified.
- Client callers use `@/features/organization-launch/client`; the primary entrypoint also contains the authenticated server loader.
- Editor and guide links preserve validated local return destinations. Private draft previews never create anonymous preview URLs.

## Presentation

- Compact 420px maximum-width launch card with a saved Public/Private indicator, short checklist rows, completion pills, highlighted next required step, and slim action footer.
- The 16:9 illustration adapts the user-supplied Framer University Three.js globe: white land dots/coastlines, gray geographic grid, black ocean, a stationary U.S. default view and optional drag. It is decorative, not a live public-location or publication indicator; no sample Italy marker is presented as an organization location. Public/Private remains saved profile state.
- Three.js 0.174.0 is dynamically imported from the installed dependency, with no Framer runtime or remote JavaScript imports. Keyboard arrows rotate it; horizontal touch drag rotates while vertical touch gestures scroll the drawer. Animation stops offscreen/when the document is hidden and respects reduced motion. Geometry, materials, instances, renderer, observers and event listeners are disposed on unmount.
- A local SVG of the same globe provides the first paint and WebGL-unavailable/context-loss fallback. Land detail is bundled, avoiding runtime GitHub requests and Mapbox dependencies for this card. Other maps are unchanged.
- Geography source: [Natural Earth 1:50m land](https://raw.githubusercontent.com/martynafford/natural-earth-geojson/refs/heads/master/50m/physical/ne_50m_land.json), [public domain terms](https://www.naturalearthdata.com/about/terms-of-use/). The compact JSON contains 8,125 land dots sampled on 1.25-degree latitude rows with cosine-adjusted longitude spacing (scanline intersection including holes) and 240 coastline rings sampled every fifth vertex from rings with at least 25 vertices, rounded to three decimals. The SVG uses the same dots/grid and initial 39-degree latitude/-98-degree longitude view.
- The checklist remains visible after publication. Optional enrichment never blocks publishing, and the footer uses saved public visibility to select its action.
- The globe uses a close 26-degree field of view. Valid saved organization coordinates center a green marker and hold the view still; there is no location toggle or drag rotation in this state. The corner label shows the saved city/region when available. Without coordinates, the globe stays on the U.S. until manually dragged and editors get an opaque Add location button that opens the inline form. Physical organization coordinates come through the authenticated active-organization query. Online-only organizations instead offer Use my location: one browser geolocation request centers a green viewer marker, labeled Your location · Only you. Existing granted permission resolves automatically; otherwise only the button requests permission. Viewer coordinates stay in component memory, are not saved to the organization or published, and never replace an online resource with a physical address. Denied, timed-out and unavailable location requests show inline feedback.

- Inline forms keep unsaved values when a row is collapsed, retain errors and edits after failure, disable repeated saves while pending, and warn before leaving via a link or page unload. Explicit Save applies only the edited section, preserving unrelated profile fields. New programs are private by default; existing program edits preserve visibility. The canonical profile action returns saved coordinates so the form can distinguish a saved address from a successfully placed map pin.
- Publication review uses only saved data, the allowlisted public projection and explicitly public-selected programs. Unsaved form drafts are never implicitly saved or published. Full-preview navigation warns about unsaved drafts.

- No automatic rotation or continuous idle animation loop. Frames are requested only to settle user interaction or redraw after resize/visibility changes; a saved location remains fixed. The SVG first paint matches the U.S. default view.
