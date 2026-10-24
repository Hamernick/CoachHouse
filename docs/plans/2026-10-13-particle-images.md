# Image cards

1. Reuse private organization document upload/open endpoints. Store only the file UUID and intrinsic dimensions in an Activity image widget; never persist a signed URL or embedded image bytes. No new table or upload backend.
2. Match the supplied image reference: rounded image, a slim title below, no date/type/status/header. Reuse the shared frame, top-right action menu, graph positioning and history. Keep full preview in the action menu.
3. Support choosing images in the Particle library and dropping image files onto the canvas. Preserve existing library/person drops. Bound batches, validate file type/size and decode dimensions before uploading. Retain uploaded references if the graph save needs retry. Uploaded files stay in Documents when cards are removed or uploads are abandoned.
4. Keep editing minimal: title, alt text and image replacement. Reuse the current inspector draft/save path. Use explicit loading/error/retry states and lazy private image resolution.
5. Focused data/operation/UI-wiring checks, types/lint and relevant guards only. User skipped final interaction review. Forms remain prototype-only; People/Metric/Finance editors, generative UI and profiling remain outside this slice.

## Implemented checkpoint

- Added the image widget to the existing Activity payload union. Image cards reuse the shared frame/action menu but show only the rounded image and its title. Full-size preview is a menu action; metadata/status/date headers are absent. Preview geometry is bounded for extreme aspect ratios and preserves image content.
- Added the Image tile to the searchable Particle library. File chooser, native canvas drop and canvas paste accept up to eight JPEG/PNG/WebP/GIF images, 15 MB each, with decoded dimension/pixel bounds. Existing Particle/person drag payloads remain separate. Native image drag is disabled so dragging the card remains a canvas operation.
- Reused private `organization-document-files` upload and signed-read endpoints, including organization scoping, entitlement/quota checks and existing authorization. Durable Particle data stores file UUID, width/height and alt text; signed URLs exist only in component state. Images resolve lazily near the viewport, with timeout/error/retry UI.
- Image inspector is limited to title, description for screen readers and replacement. Replacement disables the form while uploading and participates in dirty-draft protection. Existing files stay in Documents; removal/duplicate/history never deletes or reuploads them. Prepared references survive a failed graph save; retry reconciles the existing operation before adding any missing card IDs.
- Initial focused tests: 115 passed. Broader regression: 362 tests across 19 workspace suites passed, including nine new image cases for contracts/validation, scoped upload, object-URL cleanup, endpoint errors, shared references, history, minimal rendering/search/inspector and uncertain-save retry without duplicate upload.
- No database migration or new backend. The strict widget payload extension requires client/server decoders to ship together. Selecting an existing Documents file directly, richer document cards, image derivatives, crop/fit editing and public sharing are not implemented in this slice. Unknown/interrupted file-upload responses may leave a file in Documents; automatic upload retries are not claimed idempotent. No final browser/device review or visual baselines, per current user direction.

## Reusable Image tool refinement

1. Tighten masonry gaps from 16px to 12px and reduce record-tile spacing.
2. Keep uploaded photos in Documents and on the canvas; exclude photo/empty-image instances from library records. Show one searchable Image preset.
3. Add a validated `image_placeholder` widget through the existing preset factory. Use the same rounded image frame/title, size families and top-right action menu. Add directly without opening the inspector.
4. Drop one image onto the blank card or choose a file with the keyboard. Stop the file-drop event at the placeholder so it cannot also create a separate card. Preserve direct canvas drop/paste for separate images.
5. Upload through existing organization Documents authorization and file checks. Fill the existing Particle ID/revision without moving it or breaking references; use existing confirmed Undo/Redo. Keep successful upload references for graph-save retry. Do not overwrite a changed/deleted/locked placeholder during retry.
6. Validate schemas, library visibility, preview controls, replacement history/retry, independent outside drops and source guardrails. User retains authenticated visual review; no new tables or public media URLs.
