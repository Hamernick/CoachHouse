# Existing work: delivery checkpoint

This closes the fixed scope recorded September 15. It does not add features,
authorize release, or turn previous recommendations into an automatic backlog.

## Completed delivery scope

| Work | GitHub preservation | Quality and remaining limit |
| --- | --- | --- |
| Marketplace / People | Draft #239: `d99d2e07`; final head `259be0c3` | Implementation, GitHub preservation and hosted quality complete. 68 focused tests and Bandto 34-logo/equal-card/filter checks pass. CI35059804080: every quality lane passes; both Previews succeed. Six intended Marketplace/search/Brand screenshots reviewed across this closure. |
| Brand Identity | Separate source commit `b13e5e26` within #239; final head `259be0c3` | Implementation, preservation and hosted verification complete. User approved current field order. Eight focused asset checks plus hosted independent upload/reload/export/per-slot removal pass. Bandto file selection remains extension-blocked; hosted canary used a fresh disposable context. |
| AI authorization | Separate draft #240, `beaa15b2`, based on main | All 95 focused tests and every hosted quality lane pass in CI35057926811; both Previews succeed. Current developer staff authority required before provider calls. No production account mutation/model call performed. |

## Existing candidate dependencies

| Candidate | Relationship | Recorded result |
| --- | --- | --- |
| #235 Mobile | Main-based; shared Dialog/Sheet changes are also preserved in #237 | `ec0b73d4`, hosted quality/Previews passed. Approved mobile direction retained. |
| #237 Calendar | Main-based; overlaps the approved mobile shell | `6ce80db6`, full hosted quality/Previews pass. One full-page comparison passed on retry. Production activation held. |
| #238 Documents | Based on preservation branch `chore/local-feature-baseline-20260914`; #239 builds on it | Original 17 visual failures addressed by reviewed references in #239. Real Markdown Drive import/edit/save/reload evidence recovered. Successful native Google Doc import remains outside that proof. |
| #239 Profile / Workspace / Documentation | Stacked on #238; includes latest Marketplace and Brand Identity work | `259be0c3`: all hosted quality/Previews pass. Previously authorized Profile migrations and reversible canary already completed. Preview shares production data. |
| #229 Older combined baseline | Preserved main-based bundle; overlaps newer Documentation/Workspace/map work | Inventory reviewed; not a separate instruction to release the whole bundle. |
| #231 Resource acquisition | Stacked on #229 | Assessment and dry-run checks complete; no live owned crawl or new publication verified. |
| #240 AI authorization | Independent main-based security fix | Current-head quality green; release held. Separate proxy normalization / SQL execution concerns remain outside this patch. |

Homepage branding #236 is independently merged. Privacy/legal #233 and #234
were released before the hold. Google verification/video are complete.
No repeat migration, OAuth setup, filming or secret rotation is part of closure.

## Preserved boundaries

- Root localhost remains the review surface; owned Profile source changes match
  it. Existing dirty source, handoffs, worktrees and recovery references remain.
- Original first-login drawer confirmation is user-deferred, not a prerequisite.
- Planner assessment uses a representative Campaign canary, not a claim that
  all fourteen planners were individually exercised.
- Native Google Doc proof, physical-device coverage, live acquisition, broader
  AI/proxy hardening, Preview isolation, SEO and hosting recommendations remain
  explicitly separate from the active closure above.
- No merge, production deployment, Calendar activation, provider/database
  mutation, extra Next server, full local build/suite or Graphify rebuild.

Recovery and hosted evidence:
`/var/folders/l2/jpghvb_52t10fnrzxcs0bpd40000gn/T/coach-house-marketplace-delivery-bptjjqxc`.

## Final validation and remaining user clarification

- #239 CI35059804080: 445 acceptance suites / 2,571 tests passed, one existing skip; 149 visual tests passed and one mobile Documentation navigation test passed on retry. All screenshot comparisons and the Brand asset, article-history and offline recovery checks pass. No broad new remediation task is inferred from the retry.
- #240 CI35057926811: every quality lane and both Previews pass at `beaa15b2`. Both PR descriptions now reflect final scope and current evidence; both remain Draft.
- Root localhost matches the owned Profile source/tests/references. Root notes and overlapping dirty work remain uncommitted and preserved. Profile/AI local notes are also retained.
- Side-rail clarification is resolved: user requested Brand Identity navigation and exports on the right. The three-file follow-up is implemented and checked locally, mirrored to localhost; it is not yet in draft #239 or covered by its previous hosted run.
- Next: user review of the Brand Identity right sidebar on localhost. No additional feature task, merge or activation is queued automatically.
