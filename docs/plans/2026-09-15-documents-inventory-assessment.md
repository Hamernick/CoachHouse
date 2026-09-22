# Workspace Documents inventory assessment

Date: 2026-09-15
Assessment complete. Documents means Workspace files and core roadmap documents; Documentation remains the public learning library.

## What is implemented

- A shared library for core roadmap sections, required file slots, uploaded attachments and selected Google Drive references, with search/filter controls, grid/list views, selection and storage usage.
- Individual core/required slots accept their own attachments. Authenticated upload/list/signing/delete/restore paths preserve organization authorization, core-section association, quotas and upload rollback.
- Image/PDF thumbnails and preview dialogs use authorized private URLs; PDF navigation/error handling is implemented.
- Core/editor imports support DOCX, legacy DOC, Markdown and selected Drive files. Preview plus explicit append/replace retains revision checks; the library and editor read the same saved section.
- Serialized saves, user/organization-scoped drafts, unsaved-work recovery and conflict review preserve newer saved revisions.
- Drive imports create an editable Coach House copy with a source link. There is no two-way editing of the original Google file.
- New > Document/Spreadsheet/Presentation/Image/Note opens the existing Google tools; Folder opens Drive. These are external creation shortcuts, not automatic creation/linking inside Coach House.

## Status by boundary

| Boundary | Evidence | Remaining gate |
| --- | --- | --- |
| Product | Earlier requested library/import/recovery design is implemented; current UI is available at localhost:3000/organization/documents. | Final product review of the combined Documents experience is separate from the user's acceptance of Documentation. |
| Saved work | Draft [#238](https://github.com/Hamernick/coach-house-lms/pull/238) at702b2a8d is preserved on GitHub, based on chore/local-feature-baseline-20260914;199 files,8,724 additions/1,056 deletions. #239 inherits it. | Review/reconcile the preserved dependency baseline before a focused main-based release candidate. Bundling is intentional preservation, not a product-direction defect. |
| Code checks | Fresh70 focused tests in7 files pass. Core library card, import action and save-hook files are identical across #238, Profile and root. No code differences were found in the compared document-import, google-drive, Documents-tab and roadmap component directories between #238/#239. | Combined release candidate still needs its own final quality run. |
| Visual checks | #238 CI34874089707 still has17 screenshot failures. #2390b6a3f4a CI35017956570 passes all quality lanes with reviewed Linux references. | Preserve the later test/reference fixes when preparing the final branch. Do not reimplement working Documents code to resolve old reference failures. |
| Provider setup | Original credentials and key version were restored September10; real Picker was verified then. Google branding/data verification was approved September14 per the recorded Verification Center review. Current local menu shows Add from Google Drive. | Deployed credential identity among the two enabled client secrets remains unverified; no rotation or new consent is warranted by this assessment. |
| Live flow | September11 evidence proves selected Markdown import, edit, save/reload, persistent linked-file reference and unchanged/private original Google source. Current Documents still shows that fictional demo. | A successful non-empty native Google Doc import is not established by that sample; its export/conversion path has automated coverage. The earlier empty native Doc was correctly rejected without changing Vision. |
| Production | New import/library/save owners are absent from current main d88a0943. No new deployment or production canary was performed. | Separate release authorization and final integrated deployment/live verification remain. |

## Current checks

On Profile0b6a3f4a with one Vitest worker:

- document-import.test.ts
- google-drive.test.ts
- google-drive-routes.test.ts
- documents-banner.test.ts
- org-documents-upload-limit.test.ts
- roadmap-actions.test.ts
- workspace-documents-index-item-route.test.ts

Result:70 tests passed. Coverage includes bounded conversion/streaming, sanitization, selected-file handling, account/organization permissions, revisions, upload limits, and connection/revocation boundaries. No full suite/build or new server was used.

Bandto localhost read-only product review:30 rendered library items, storage meter loaded at3,235,452 bytes of5GiB, no alert, no horizontal overflow in desktop/grid or390px list/grid. Mobile grid cards are161px wide. Count includes core/empty slots and references; it is not30 uploaded files. New menu and grid/list switching work. Original grid view and desktop viewport restored. No upload, import, edit, delete, OAuth consent, provider setting or database mutation was performed.

## Existing live evidence: use it instead of repeating setup

The September11 runlog supersedes the earlier September4 checklist statement that a canary is still open. Evidence files were found and read during this assessment:

- test-results/google-drive-demo/file-baseline.json:2026-09-11T00:49:49.908Z; private sample and local-byte match recorded.
- test-results/google-drive-demo/source-integrity.json:2026-09-11T00:55:09.162Z; Google content/checksum, modified time, private sharing and original empty Doc all unchanged.
- test-results/google-drive-demo/ui-rehearsal.json:2026-09-11T00:58:50.731Z; linked reference visible, source accessible, Coach House-only edit absent from original.

These establish the recorded historical canary, not a new token refresh, fresh import, native Google Doc success, or production deployment today. The sample and saved Vision content were preserved.

## Visual failure disposition

#238's failing run contains4 Documents list screenshots,4 Roadmap conflict-dialog screenshots and9 Documentation cases. The corresponding #239 changes add separately reviewed Linux references and suppress React Grab only in visual tests. Existing platform-neutral references and thresholds remain; soft assertions still fail tests. The source review is documented in docs/qa/profile-visual-reference-review-20260915.md; subsequent exact-head CI35017956570 is successful.

## Outcome and next step

**Documents implementation and historical live Markdown/linked-file canary are preserved; assessment100%.** Release readiness remains separate: dependency integration, final product review, combined quality checks, any remaining native-Doc canary, and explicit deployment authorization. No functional source defect was established in this bounded review.

Next focused implementation: Marketplace People pagination preserving the current resource filters. Brand Identity's exact field order still awaits the two visible label names; first-login drawer confirmation remains user-deferred.

Inventory note: GitHub now records homepage PR#236 merged on2026-09-15T22:48:15Z as d88a0943. This session did not merge it or change PR draft status; its deployment was not inspected. Preserve this updated fact alongside the release hold on remaining work.
