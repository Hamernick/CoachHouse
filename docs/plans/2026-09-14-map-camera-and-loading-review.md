# Map marker framing and detail loading review

Assessed September 14, 2026; continued after the chat restart checkpoint. No production merge/release or map redesign.

## Latest verified state: integration complete for review

- Mobile draft #235 now has HEAD `3aa31a3331d217509dab280a77354a68abe6a2f2`, clean and synced. `b2e9f342` saves camera/loading integration; `3aa31a33` updates the existing performance contract to follow the relocated loader. All quality lanes pass in hosted CI [34920789909](https://github.com/Hamernick/coach-house-lms/actions/runs/34920789909), including both held-chunk detail-loading cases at 1440/390px. No visual baselines were changed in this follow-up.
- Both Previews are Ready and explicitly non-production. Primary deployment 6450395192: https://coachhouse-jog0q1jxs-calebs-projects-58ab1538.vercel.app . Secondary deployment 6450404711: https://coach-house-platform-2c7ey1qis-caleb-hamernicks-projects.vercel.app . This pass inspected the integrated localhost UI; it did not perform a new manual hosted-Preview canary.
- Root localhost now includes the focused approved mobile map/navigation presentation and its existing category-matching optimization. Fifty-two source/test files were integrated, plus the acceptance manifest entry. This is selective integration into the existing dirty checkout, not a branch merge or complete import of #235's Workspace/Calendar/Build presentation changes.
- Six overlapping files were reviewed. Root's newer header search and Calendar unmount/view-selection behavior were retained; Calendar gained the approved sidebar placement. Root's newer public Build/Collect header layout was kept. Existing About us/drawer changes and every one of 42 previously dirty files were hash-verified unchanged before the final intentional note appends.
- Recovery: `/var/folders/l2/jpghvb_52t10fnrzxcs0bpd40000gn/T/coach-house-mobile-local-integration-ddvhpbmc`. Includes root tracked patch, protected hashes, prior/base/Mobile/candidate files, manifest and final integration hashes. Preserve it.

### Live evidence on localhost

Bandto at 390x844: fullscreen map, icon-only Menu/Notifications/Search/Profile, circular avatar, inline location/Active/Welcome/weather controls. Search opens the combined drawer and finds the existing Abraham House Inc. directory record. Selected marker is visibly above the open drawer: marker around154px, drawer top347px/height473px. All four navigation buttons measure60px high. Sidebar opens above the map and includes Calendar. Expanded resource panel measures top12px/height820px and covers underlying map controls; collapse returns to98px. Captured fresh-page error list is empty. Desktop layout was inspected after restoring the normal viewport.

The resource Details labels it Seed preview; this is a UI/camera canary against an existing directory record, not a new publication or independent provider-content verification. No data was saved, collected, shared or edited.

Root validation: 74 focused map/shell/navigation tests plus39 category/performance tests pass (113 total), targeted ESLint, structure, import boundaries, interaction-lock guard and whitespace pass. Initial integration had a duplicate loader import and a function-length lint failure; both were corrected before final verification. A fresh page completed loading after the approved category normalization optimization was included. Browser automation remained intermittently unreliable; no causal claim ties that tooling issue to the application.

Existing Next server stayed on port3000; no additional server, full local build/suite or Graphify rebuild/update. Fresh local map tab1787351860 is marked deliverable; viewport override reset. Prior agent map tab1787351857 lost debugger attachment and its close request failed; do not assume it remains controllable. Rediscover handles next turn.

### Remaining / next

This camera/loading feature is ready for review with hosted quality passing; production remains held. Physical iOS keyboard/safe-area verification remains open. The original first-authenticated-load Workspace drawer symptom still needs its exact cold-load proof and confirmed root cause; the narrower resize defect is fixed separately. Next inventory feature: map result-card size/content and resource guides, reviewed separately from this camera behavior.

The earlier checkpoint and table below are historical.

## Latest integration checkpoint

The existing Mobile #235 worktree now contains a focused local integration of bottom-drawer camera padding, map recreation handling and panel-local detail loading. Its prior clean/synced HEAD remains 7401b83a; the new changes are uncommitted and unpushed. Seven source files and two test files changed/added; the approved fullscreen map, combined navigation and Welcome/weather controls are preserved. Targeted lint, 41 tests and whitespace checks pass. A copied held-chunk browser regression still needs hosted validation against the new Mobile combination.

Root localhost already contains the camera/loading behaviors; the whole final Mobile presentation has not been synchronized there. Preserve overlapping root work when preparing that combined review. Browser control fails even on a fresh blank tab, while the user confirms normal Chrome interaction. No live marker framing proof exists yet. Exact files, recovery location and next steps: [chat restart checkpoint](2026-09-14-chat-restart-checkpoint.md).

The table below records the earlier source assessment before these local Mobile edits.

## Feature

Opening a mapped organization/resource should keep its marker in the visible map area above the drawer. Loading its details should leave the map mounted and usable.

| Dimension | Evidence |
| --- | --- |
| Product direction | Preserve the approved fullscreen mobile map and combined drawer/navigation. This is camera/loading behavior, not a new visual direction. |
| Code readiness | Root localhost and Profile 559dd008 share the inspected camera/runtime/detail-loader code. Fifteen focused camera/helper tests pass locally. |
| Saved work | Drawer-height camera padding is saved in #229 at 4c42e323 and retained in Profile. Panel-local dynamic detail loaders are retained in the preserved newer baseline/Profile. |
| Mobile integration | #235 at 7401b83a does not include bottom drawer camera padding or the panel-local detail-loader helper. Inspected main cb9287b1 also lacks bottom drawer padding. Preserve these technical fixes when integrating the approved mobile presentation; absence from the newer branch does not supersede them. |
| Configuration | The camera/loading correction adds no provider setup. Ordinary map rendering still uses existing Mapbox configuration; no settings changed. |
| Deployment | Present on Profile Preview and existing localhost source. Not a production release. |
| Verification | Hosted visual job 104218722477 passed the two held-chunk detail-loading checks at 1440px/390px (3.6s/4.7s): map stays mounted, details open/reopen, no loading-loop errors. Fixture data is synthetic only inside those intercepted tests. Live public marker framing remains unverified in this pass. |

## Source ownership

- src/components/public/public-map-index/public-map-index-runtime.ts: useSyncSidebarCameraPadding accounts for drawerInsetBottom, map recreation and reduced motion.
- src/components/public/public-map-index/map-view-helpers.ts: resolvePublicMapCameraPadding adds drawer height to bottom edge padding.
- src/components/public/public-map-index/sidebar.tsx: reports the active drawer inset to the map.
- src/components/public/public-map-index/sidebar-detail-loaders.tsx: all four lazy detail components use a panel-local loading boundary.

## Browser limit and next step

Opened localhost home and observed the real Food category (one result). Subsequent Playwright and screenshot operations timed out at the browser-control layer; no reliable post-click marker measurement was obtained. Do not describe this as an application hang or proof the camera fix works/fails. Browser discovery still lists the local tabs. Next: finish the live marker-above-drawer check, then scope preservation in mobile integration. No additional Next server or full local build/suite was used.
