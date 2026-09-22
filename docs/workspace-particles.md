# Workspace particles

## Behavior

- Particles is a tab in the existing workspace drawer. Its compact auto-filling catalog uses real source previews, search, and Organization / Activity / Roadmap / Objectives / Drive / Images filters. Only the catalog scrolls; a content-aware fade marks cropped rows and clears at the end.
- Organization and Activity are handles for the existing `organization-overview` and `programs` Workspace cards. Show focuses the existing card; dragging the catalog tile repositions that card and persists its normal board coordinates. No separate particle placement is created. Legacy duplicate placements are discarded during board normalization.
- Selecting either existing card shows the particle-style toolbar with Small, Medium, Large, and Remove controls. Size changes use the normal board-card size state. Remove hides the card; Show or a catalog drag restores the same card, with a drag also updating its position.
- Each roadmap section is a reference to the original section ID. Saving inside the drawer updates its particle; returning from the editor tab refreshes the source. The canvas stores no duplicate section content.
- Google Drive attachments keep the application attachment ID as their source reference. Google links use the separate provider file ID. Large selected cards load a Google preview; Edit opens Google's editor in a new tab. Google still enforces its own file permissions.
- Images are private organization assets. Their read route verifies active organization membership and the exact organization-scoped path before issuing a 60-second signed URL, including for board/member viewers; direct legacy bucket reads remain restricted. Images are displayed without color filters, cropping, or public image optimization. PNG, JPEG, and WebP uploads are checked on the server for file size, MIME type, and matching signatures.
- Drag a catalog tile or roadmap grip onto the canvas. Click Add or press Enter on the grip as a keyboard alternative. Select a particle for Icon (88 × 88), Mini (288 × 212), Large (640 × 460), Edit, and Remove.
- Source-drag state stays inside the Particles provider, catalog tiles are memoized, and particle React Flow changes bypass the main Workspace node pipeline. The drawer remains stationary during a source drag, and the trailing browser click after a completed drag is ignored.
- Drag a placed particle back onto the Particles tab/catalog or use Remove. Original sections, Drive attachments, and uploaded images remain available. Organization and Activity stay as permanent Workspace cards.
- Positions, sizes, references, and connections use the existing authenticated board autosave. An unknown-node recovery record in the existing forward-compatibility envelope survives older clients' saves. Invalid/duplicate references and connections are normalized away.
- Plan objective creates a connected objective → decision → actions tree directly on the Workspace canvas. Users can write it manually or request an OpenAI draft, review it, and then save the editable tree to the organization board.

## Ownership and review

Feature owner: `src/features/workspace-particles`. Route adapters compose it with the existing board; shared node-frame primitives own the visible card shell. Roadmap navigation and editor-save notifications provide the linked-section integration. The Drive Picker client reuses the existing implementation from the parallel Documents workstream.

The feature is composed directly into `/workspace`; there is no separate product or fixture canvas.

Tests cover board normalization, compatibility recovery, source IDs, private image authorization and validation, desktop drag/return, keyboard movement, sizes, linked refresh, read-only interaction, and image appearance. Browser checks also exercise touch dragging and connections. Google OAuth/Picker and a real private-storage upload still require a configured-account canary before release.

## Initial limits and pricing assessment — September 16, 2026

### Implemented

| Limit                          | Purpose                                 | Enforcement                                                      |
| ------------------------------ | --------------------------------------- | ---------------------------------------------------------------- |
| 4 MiB per uploaded image       | Fits the hosted request envelope        | Browser and authenticated image API                              |
| 100 placed particles per board | Bounds rendering and stored layout size | Controller and board normalizer                                  |
| 100 image references per board | Bounds board metadata                   | Controller and normalizer; **not an organization storage quota** |
| 300 particle connections       | Bounds graph size                       | Board normalizer                                                 |

Vercel documents a 4.5 MB function request limit, so the image limit leaves room for multipart overhead. Larger files would need a signed direct-upload flow. [Vercel function limits](https://vercel.com/docs/functions/limitations#request-body-size).

### Costs and proposed packaging

Current advertised prices in `src/components/public/pricing-surface-data.ts` are Individual Free, Organization $20/month, and Operations Support $58/month. These are source-code prices; live Stripe configuration and actual provider usage were not audited.

Supabase Pro lists 100 GB included file storage, then $0.0213 per GB-month; uncached egress includes 250 GB, then $0.09/GB. Cached egress has its own 250 GB allowance and $0.03/GB overage rate. Allowances are shared project capacity, not a fresh allowance per customer. [Supabase pricing](https://supabase.com/pricing), [storage usage](https://supabase.com/docs/guides/platform/manage-your-usage/storage-size), [egress usage](https://supabase.com/docs/guides/platform/manage-your-usage/egress).

For scale: 100 maximum-size images occupy about 0.4 GB, under $0.01/month in marginal storage overage. Serving 5 GB of uncached image data costs about $0.45 beyond the included allowance. These examples exclude database, compute, support, other product usage, and AI; they are not a total cost or margin estimate. Drive documents remain references and Google-served previews, with no copied file bytes or model calls in this feature.

Suggested starting quotas, **not yet applied**:

| Plan               | Uploaded image storage per organization             |
| ------------------ | --------------------------------------------------- |
| Individual         | 100 MB                                              |
| Organization       | 1 GB                                                |
| Operations Support | 1 GB; storage need not differentiate a support plan |

Keep the per-image and canvas limits common across plans. Measure stored bytes, upload counts, and monthly egress before increasing quotas or charging for additional storage.

Before enforcing paid-plan quotas, add an atomic server-side byte reservation/usage ledger, an organization usage display, permanent image-library deletion, and cleanup of abandoned uploads. Removing an item from the canvas intentionally does not delete its file. Current per-file validation and metadata limits do not cap total stored bytes across repeated API calls. Billing, paid-plan entitlements, provider settings, and production storage policies are unchanged.
