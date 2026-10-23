# LIVE-04: compact upgrade banners

Original source: packet03 later intake U20261013-01, scoped stage2 billing entry presentation. User requested smaller free-account upgrade banners with proper gaps and maximum widths. User confirmed PR297 merged and explicitly took ownership of visual checking; no merge verification, production browser pass, screenshots or automated UI journey was performed for this continuation.

## Scope and implementation

Branch `fix/upgrade-banner-layout-20261013`, worktree `coach-house-platform-upgrade-banners-20261013`, base `e49a31bd3544094a18e11905e13192fac2ee93c6`. One shared FeatureUpgradeNotice change covers Documents, Roadmap, Accelerator and invitations. Center a maximum768px wrapper with16px vertical gaps and horizontal insets. Use container width to place the CTA beside copy in sufficiently wide panels; narrow drawers stack it with a44px touch target. Preserve copy, entitlement checks, checkout behavior and focus restoration. Long headings wrap.

Local user review: http://localhost:3116/visual-regression/upgrade-banners. Uses the actual shared component in wide/narrow examples, gated by the existing visual-regression access guard; enabled only in this local server process. Actual app: http://localhost:3116/my-organization. No Supabase previews or provider changes. Shared env and unrelated servers remain untouched.

## Checks and stop boundary

Changed-file ESLint, route-entry contract and diff checks pass. Styling-only change: no new implementation-mirroring tests, automated screenshots or baseline replacement. User reviews appearance; existing hosted CI/review remain required before release. Graphify refresh started. Stop at this bounded banner PR and user review; Calendar is next after this slice. Prior map production/rendering verification belongs to the user and is not asserted complete from their merge confirmation.

## Documents follow-up — October 13

User production review reports that Documents still has too much copy and touches the toolbar. Continue in the same clean banner checkout on `fix/documents-upgrade-notice-20261013`, based on main `32e5199e` (PR298). Replace the long paragraph with “Use Google Drive for free. Upgrade to create and edit documents.” Reserve 24px below the Documents toolbar with an explicit bottom margin; neighboring notice margins collapse to the larger gap. Shared banner sizing and other notices remain unchanged. The paid storage row also respects this toolbar separation.

Actual Documents route: http://localhost:3116/organization/documents. Copy preview: http://localhost:3116/visual-regression/upgrade-banners. User owns appearance review; no screenshots or visual baseline updates before approval. Check changed-file lint and existing Documents toolbar/library tests. Stop at this small follow-up PR and required CI/review; preserve PR299 map work and its unapplied coordinate repair.
