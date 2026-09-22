# Map result cards and guides review

Assessed September 14, 2026. Production release remains held. The user selected shorter result rows; the existing compact design is implemented and larger-card work is preserved.

## Latest correction after user feedback

User reported excessive width and changed card styling. Profile496ef3cf restores the earlier image/category fallback, subtitles/taglines and two-line title treatment with smaller56/64px media,80px minimum height and natural growth for wrapped content. The populated results column uses max-w-xl; guide box and search row measure556px at1440px. Card84px desktop/96.5px at320px, without horizontal overflow.40 existing tests and focused lint pass; root/Profile source matches. Final CI34928174391 passes all nonvisual lanes; visual130 pass/1 flaky/17 fail, same failed-name baseline, no newly failing cases. Both non-production Previews Ready. [Current Preview](https://coachhouse-p8hj3ttly-calebs-projects-58ab1538.vercel.app/?guide=transportation-access). No production release. Recovery: `/var/folders/l2/jpghvb_52t10fnrzxcs0bpd40000gn/T/coach-house-map-card-style-correction-1pwa569p`.

Mobile #235 still contains the plain icon rows; its saved-guide ID preservation correction remains separate. Preserve this latest card presentation when preparing a combined release candidate. This supersedes the plain icon-row presentation below. The earlier sections preserve the assessment and implementation history.

## Feature: result cards: compact rows approved and implemented

The user selected **shorter rows**. Applied the existing Mobile compact cards to root localhost and the Profile branch; no surrounding map/navigation redesign.

| Dimension | Verified state |
| --- | --- |
| Product | Compact rows approved. This supersedes the larger-card direction for map search results. |
| Code | 80px minimum rows, 44/48px category icons or organization avatars, one-line titles and category/location metadata. Full accessible names, details, collection controls and React Grab ownership are preserved. |
| Saved work | Profile source commit `25b48860`, followed by test-only correction `22ff5b30`. Existing draft #239; root receives the same two card files and two updated test files. Mobile #235 already has this card design. |
| Preservation | Larger cards remain in #229 at4c42e323 and Profile history559dd008. Prior root/Profile files and worktree patches are archived at `/var/folders/l 2/jpghvb_52t10fnrzxcs0bpd40000gn/T/coach-house-compact-map-rows-78bgzq6o`. Local-only Profile runlog entries remain unstaged. |
| Configuration | No provider setup or feed change. The fast index includes supplied marker images/subtitles, but omits full descriptions, logo and favicon fields. Compact rows show category/location metadata; details retain their existing content. |
| Deployment | Localhost is current on existing PID47084/port3000. Profile22ff5b30 is pushed to draft #239. Both Previews are Ready and explicitly non-production. [Primary Preview](https://coachhouse-4p7mibtit-calebs-projects-58ab1538.vercel.app/?q=Abraham), deployment6451216044; secondary6451225553. Both deployment records match SHA22ff5b30fd0568620f062ec75cfd12b263976ea0. Production remains held. |
| Live verification | Bandto localhost:80px rows at 320/390/1440/2560px; no row or page horizontal overflow. At 320px, long titles use ellipsis, drawer height 820px, clientWidth 294px equals scrollWidth 294px. Abraham House details open and Back to search restores the list. Collection controls were not clicked. Normal browser viewport restored. |
| Checks | 40 focused layout/ownership tests, targeted lint and whitespace pass. Final [CI34925678644](https://github.com/Hamernick/coach-house-lms/actions/runs/34925678644) passes static, acceptance, build/performance and RLS on22ff5b30. Visual:131 passed,17 failed; exact failed-name match with prior34917646107, no newly failing cases. Matching names do not prove identical screenshot differences/root causes. Aggregate quality remains blocked. |

Followed docs/design.md's compact type/spacing, readable metadata and visible focus direction with existing shadcn controls. No new tests, full local builds/suites, extra Next server or Graphify refresh. Fresh Bandto localhost tab 1787351875 is marked deliverable; rediscover handles in a new chat.

Some listed records remain Seed preview; two 100% Playground records also appear. These are separate directory/content issues, not card layout failures. No directory content was edited.

## Feature: resource guides

The newer preserved work adds Basics (essentials), Transportation, Documents & ID and Digital Access. Their definitions and IDs match root, #229 and Profile; Mobile/main currently lack their definitions. Guide filtering selects existing directory records and deduplicates by selectable ID; it does not independently verify service availability.

Local loaded state: 24 guides; Basics 1549 records, Transportation 1, Documents & ID 4, Digital Access 1. These are directory membership counts, not field-complete, independently verified or publishable counts.

### Live Transportation check

Opening Transportation sets `/?guide=transportation-access`, opens Find and filters to one record: Riders Alliance. Reload retains that selection, with Search reopening the filtered drawer. The detail fetch exposes an online resource categorized Civic Engagement/Transportation/Community and marked Seed preview/External data. Its content describes transit advocacy; the official provider homepage also presents grassroots transit organizing: https://www.ridersalliance.org/ . This is not verified evidence of direct ride assistance, despite the guide's rides/transit-support description. Content readiness remains open. No Save/Collect/Share action was performed.

The current count copy says "1 places" and also calls online resources places; a small copy correction is still open. The four focused existing guide tests pass, as do the existing transport/preferences tests.

## Corrected compatibility defect: saved guide IDs

Mobile #235 and inspected main omit the four newer IDs from the shared normalizer. On that source version, reading preferences drops the IDs and a PATCH of an unrelated favorite saves the shortened list. Five new mocked route regressions reproduced the issue; no affected real account has been established or modified.

Mobile commit `d553f577` adds those four known IDs to the allowlist without adding guide definitions or changing featured guides/card visuals. Unknown IDs still fail normalization. All 39 tests in the two focused route/resource-map files pass, plus targeted ESLint. The root already accepts these IDs; it received the same route regression tests after verifying that its prior test exactly matched Mobile HEAD. All 9 root route tests pass. Recovery: `/var/folders/l 2/jpghvb_52t10fnrzxcs0bpd40000gn/T/coach-house-guide-preservation-eneqrc3l`.

Initial hosted run 34924480322 passed static, acceptance, RLS and visual, but its build caught an inferred lookup type that excluded the newly recognized guide IDs. Follow-up `f12fbdc9` explicitly types that lookup for all known IDs; missing definitions remain safely omitted from the UI. All39 focused tests and targeted lint pass again. The identical root builder received this type correction after a recovery copy; its four focused guide tests pass.

Final source HEAD `f12fbdc9b9e178a8c0c5361e03145b9688c1f553` is pushed to existing draft #235; every lane passes in hosted [CI run 34924762490](https://github.com/Hamernick/coach-house-lms/actions/runs/34924762490), and both Vercel Preview checks succeeded. Mobile source is clean and synced. The older green run at 3aa31a33 is not evidence for this new commit. This preparation does not correct deployed production code; production release remains separately authorized. No full local build/suite, Graphify rebuild/update, additional Next server, migration or account/provider change.

## Next

Compact rows are complete for review on Profile22ff5b30 and localhost, with the existing17 visual failures still blocking aggregate quality. Next: review whether resource-guide content meets its stated purpose before treating it as ready for production. The saved-guide correction is complete for review on Mobile f12fbdc9. The original first-authenticated Workspace drawer symptom remains unproven; the AI authorization fix remains separately prepared locally.

Final visual comparison: `/var/folders/l2/jpghvb_52t10fnrzxcs0bpd40000gn/T/coach-house-compact-map-rows-78bgzq6o/final-visual-comparison.json`. Hosted deployments are verified; this follow-up's manual UI canary was on localhost.


### September15 - card width clarification

User clarified that the Show all card itself must share the other content cards' maximum width. Final source gives PublicMapSearchContextCard mx-auto/w-full/max-w-3xl (768px), matching status/filter/result-list width; the previous max-w-xl cap around the populated column is removed. Root/Profile/Mobile agree on both changed source files. Desktop1792px: context/status/list all x622,width768; mobile390px: all x23,width344.36 existing layout checks and focused lint pass. Profile813a9257 and Mobile1783d3cc are pushed to existing drafts; hosted validation pending. This supersedes the earlier whole-column width decision; other saved work remains intact.


### September15 - smaller image rows and excess list spacing

Final rows use44/48px imagery,14px two-line titles,12px excerpt/metadata and64px minimum/automatic height. Short list frames fit content; long lists scroll. Guide-to-list gap is8px. Full imagery/supporting-text presentation is now synchronized to Mobile too. Root/Profile40 existing tests and Mobile39 pass. Desktop one-row frame66px, row64px; mobile390px rows64–73px, keyboard scrolling and resource-detail/Back verified. Profiledf5b1eac and Mobile1b1e7fd2 pushed to existing drafts; hosted validation pending. Older80px minimum,56/64px media and full-height short-list shell are superseded. Recovery: /var/folders/l2/jpghvb_52t10fnrzxcs0bpd40000gn/T/coach-house-compact-image-rows-lr5rshkk.


### September15 - Transportation content readiness completed

Current localhost Transportation still has one record: Riders Alliance. Filtering and detail/Back work. Category matching selects community_transportation, whose broad transit alias includes advocacy; this does not establish direct ride assistance. Official provider homepage was checked again September15 and supports organizing/advocacy. Guide scope remains unchanged.

Offline audit of the single record from the explicit curated preview: 1 examined; 0 field-complete, 0 verified, 0 publishable. Missing specific service, eligibility, hours, sufficient source comparisons and completed verification. No content, membership or publication changes. Evidence is in /var/folders/l2/jpghvb_52t10fnrzxcs0bpd40000gn/T/coach-house-guide-count-copy-vi7_tze9/transportation-audit.json . This is not a global directory count.

Guide count wording now uses resource/resources on cards and in the selected-guide context. Live singular/plural checks and four existing guide tests pass. Root/Profile/Mobile source is synchronized; production unchanged. The four newer guide definitions remain a separate preserved product direction; this copy fix adds no definitions to Mobile.

Mobile895c74fd hosted CI34931005601 has57 visual passes and2 failures at the obsolete8px Active-gap assertion. Corrected that expectation to the approved6px; rerun still required. Do not treat this as completed screenshot verification. Next feature: Documents & ID guide.


### September15 - Documents & ID guide assessment

| Dimension | Evidence / readiness |
| --- | --- |
| Product | Preserved guide promises identification, records, applications and enrollment help. No product scope change. |
| Current records | Four rows are two centers, each repeated across NYC Cooling Centers and Cool Options: Eastern Queens CC0396 and Brookville CC0397. Matching record IDs, names and street locations establish these two duplicate pairs. |
| Behavior | Deep link opens four filtered results. Eastern Queens details and Back work. At390px all rows64–65px, no horizontal overflow. No Save, Collect, Share, phone or registration action. |
| Service evidence | Both official provider center pages explicitly describe benefits-filing assistance, so enrollment relevance has real support. Direct ID replacement was not established. Stored records describe cooling centers and lack the provider-service evidence. |
| Category provenance | Stored classification evidence matched the alias snap in title/organizationName. Here SNAP means Services Now for Adult Persons; that match alone was not evidence of benefits enrollment. The independently consulted provider pages support the service, but no verification ledger was changed. |
| Data quality | Both source families attach718-525-8899 to Eastern Queens and718-454-2100 to Brookville. Provider center pages list the reverse: Eastern Queens718-454-2100; Brookville718-525-8899. Treat as a source contradiction to reconcile, not an automatically approved overwrite. |
| Code defect | The inspected Eastern Queens detail omits its stored street address. Adapter reads address separately from addressStreet; buildResourceAddressLines uses the structured address fields and only falls back to full address if that list is empty. City/country make the list nonempty and suppress the available full address. Concrete owners: resource-map-local-preview-adapter.ts and resource-detail-helpers.ts, composed by PublicMapResourceAddressSection. |
| Exact audit | 4 examined records;0 field-complete,0 verified,0 publishable. All4 lack a public summary, eligibility, access instructions, provider source, useful hours, sufficient source comparisons and completed enrichment verification. Existing phone presence does not mean it is correct. |
| Configuration | Existing explicit curated source-family-plus-brooklyn-preview.jsonl; no feed/provider setting changes. |
| Saved/deployed | Source remains on Profile0315e1e8 and Mobileff89a8ae, with root localhost current. This assessment only appends local notes and saves a four-record offline audit; no source, feed, database, draft or production change. |

Provider pages checked September15:
- https://snapqueens.org/senior-centers/snap-brookville-older-adult-center
- https://snapqueens.org/senior-centers/snap-of-eastern-queens-older-adult-center
- https://snapqueens.org/programs/case-assistance

Center pages show9am–3pm while the general case-assistance page lists8:30am–4:30pm office hours. Preserve this distinction and confirm service-specific access before preparing records; do not merge hours blindly. Provider pages also describe transportation, which is a later source-backed candidate for the Transportation guide, not an already added or verified resource.

Offline evidence: /var/folders/l2/jpghvb_52t10fnrzxcs0bpd40000gn/T/coach-house-documents-id-assessment-a37fe4e7 (documents-id-records.jsonl, audit.json). Primary website inspection is not a completed two-pass verification or approval.

Correction priorities: (1) fix the street-address display with a focused regression, (2) prepare separate source-backed benefits-assistance records with deduplication and phone-conflict resolution, (3) complete verification and review before any publication. Keep original source records and saved IDs preserved. Next feature assessment: Digital Access.

Mobileff89a8ae now passes aggregate hosted quality in CI34931691025, including visual; the6px assertion correction is validated. Profile0315e1e8 visual remained in progress at this checkpoint. No production release.


### September15 - Street address corrected and Digital Access assessed

The earlier missing-street display defect is fixed in Profile86dee872 and Mobile43087dcd; existing draft PRs239/235 remain drafts. Root localhost shares the exact formatter. Full supplied address lines now take precedence over partial city/country fields when addressStreet is absent; structured street addresses retain existing formatting. Four regressions include two that failed before the fix; all35 root resource-map tests and Mobile4 focused cases pass. Focused lint/whitespace pass; live Eastern Queens address now renders, with no text overflow at390px. Hosted results for these new commits are pending. Recovery: /var/folders/l2/jpghvb_52t10fnrzxcs0bpd40000gn/T/coach-house-resource-address-fix-uwhfgxye . Previous root/Profile notes preserved. No record or database edits.

#### Digital Access

| Dimension | Evidence / readiness |
| --- | --- |
| Product | Preserved scope: internet, devices, digital skills and online support. This assessment adds no service or changes guide membership. |
| Current inventory | One row: Woman Unsilenced, Brooklyn directory IDd72eb6c4400c1a2ea97f372b. One provider; no duplicate within this guide. |
| Behavior | Localhost deep link shows1 resource; detail opens with provider/Facebook links, service summary and East/North Brooklyn service area. Back restores the selected guide. No Collect/Share/subscription action. |
| Provider evidence | Official https://womanunsilenced.org/ explicitly describes digital-literacy, career and entrepreneurship training. It supports the digital-skills part of the guide; internet/device provision and current enrollment were not verified. |
| Data readiness | Stored eligibility is missing, hours empty, access instructions generically say to check the website. Stored enrichment has publicResourceEligible=false. The public-service hold must be reconciled with retained provider evidence through the normal review process, not bypassed because of this website inspection. |
| Exact audit |1 examined;0 field-complete,0 formally verified,0 publishable. Stored gaps: public-service hold, eligibility, hours, insufficient source comparisons and incomplete verification. Current provider evidence does not itself satisfy two completed comparisons or approval. |
| Configuration/deployment | Existing explicit curated preview file; record still labeled Seed preview. No feed/provider/production change. Guide definitions remain preserved in Profile/root; the address fix does not add newer guide definitions to Mobile. |

Audit input/result: /var/folders/l2/jpghvb_52t10fnrzxcs0bpd40000gn/T/coach-house-digital-access-assessment-c7z3v6xe . No new source changes for this guide and no repeated tests for unchanged guide behavior. Next feature: Basics, then consolidate map readiness blockers.


### September 15 - Basics assessment completed

| Dimension | Evidence / readiness |
| --- | --- |
| Product | Preserve Basics: food, shelter, health, transportation, documents and digital access. Fixed an omitted education_digital_literacy category; Woman Unsilenced now appears in Basics as well as Digital Access. Other education categories remain outside Basics unless another matching category applies. |
| Code | Existing guide regression failed4-versus5 before the one-category correction and passes afterward. Applied to root localhost and Profile. Mobile does not contain the newer Basics goal definitions, so no wholesale integration was performed. |
| Inventory | Curated external preview:1,538 Basics records after the fix (previously1,537). Localhost displays1,550 total guide items, including platform organizations; the external-only audit does not cover those organizations. |
| Evidence |1,538 examined;0 field-complete,0 approved verification,0 publishable.1,493 lack eligibility;126 lack actionable contact;628 lack provider evidence;990 lack useful hours;558 lack a public summary;544 lack access instructions. All1,538 lack completed source comparisons and approved enrichment.23 entries originate in Wikidata discovery evidence and need actionable provider corroboration. |
| Actual canary | Opened @onlunchbreak x @girlsonlyny Fridge. The detail retains an out-of-order report dated May27,2025 and explicitly requires current confirmation. Its current condition was not verified: the linked Fridge Finder page could not be retrieved in this review. The UI also displays source status and dates that must not be confused with approved enrichment verification. |
| Configuration | Explicit curated local preview file remains unchanged; no ingestion, provider setting, account or database modification. |
| Release | Assessment complete, data publication blocked by the evidence gaps. This does not approve release or assert that the resource inventory is production-ready. |

Evidence: /var/folders/l2/jpghvb_52t10fnrzxcs0bpd40000gn/T/coach-house-basics-assessment-w3cdaQ (`audit-after.json`, `summary-after.json`, `basics-records-after.jsonl`). Primary source attempted: https://www.fridgefinder.app/fridge/@onlunchbreakx@girlsonlynyfridge .

The current Workspace/map assessment is100% documented across its reviewed surfaces and four primary guides. It does not close the older inventory's Documentation planners/Marketplace, Calendar integration, acquisition pipeline or Documents release work. Product approval, implementation, configuration, deployment and evidence remain separate. Latest seasonal instruction: normal versions below the heat gate even in cooling guides; see [seasonal presentation](2026-09-15-resource-seasonal-presentation.md).
