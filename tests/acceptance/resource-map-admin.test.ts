import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  buildResourceMapReviewSummary,
  normalizeCanonicalEditInput,
  normalizeCanonicalStateInput,
  normalizeImportReviewInput,
  normalizePromotionInput,
  safeResourceMapExternalUrl,
  normalizeVisibilityInput,
  type ResourceMapAdminImportRecordDetailRow,
} from "@/features/resource-map-admin"

const ROOT = process.cwd()

function readSource(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8")
}

describe("resource-map-admin feature contract", () => {
  it("normalizes admin curation inputs before server mutations", () => {
    expect(
      normalizeCanonicalStateInput({
        target: "service",
        id: " service-1 ",
        action: "hide",
        reason: "  duplicate listing  ",
      })
    ).toEqual({
      target: "service",
      id: "service-1",
      action: "hide",
      reason: "duplicate listing",
    })

    expect(
      normalizeCanonicalEditInput({
        target: "organization",
        id: " org-1 ",
        fields: {
          name: " Demo pantry ",
          website_url: " https://example.org ",
          donate_url: "",
        },
        reason: " clean up public copy ",
      })
    ).toEqual({
      target: "organization",
      id: "org-1",
      fields: {
        name: "Demo pantry",
        tagline: null,
        description: null,
        website_url: "https://example.org/",
        donate_url: null,
      },
      reason: "clean up public copy",
    })

    expect(
      normalizeImportReviewInput({
        importRecordId: " import-1 ",
        status: "approved",
      })
    ).toEqual({
      importRecordId: "import-1",
      status: "approved",
      reason: null,
    })

    expect(
      normalizeVisibilityInput({
        kind: "contact",
        id: " contact-1 ",
        isPublic: true,
      })
    ).toMatchObject({ kind: "contact", id: "contact-1", isPublic: true })

    expect(
      normalizePromotionInput({
        importRecordId: " import-1 ",
        promotedOrganizationId: " org-1 ",
      })
    ).toMatchObject({
      importRecordId: "import-1",
      promotedOrganizationId: "org-1",
      promotedServiceId: null,
    })
  })

  it("blocks approval until source-grounded enrichment is complete", () => {
    const record = {
      confidence_score: 92,
      source_url: "https://example.org/resource",
      quality_flags: [],
      reason_codes: [],
      raw_snapshot: { serviceTitle: "Community Food Pickup" },
      extracted_fields: {
        serviceTitle: "Community Food Pickup",
        description:
          "Weekly grocery pickup with pantry staples and fresh food for local households.",
        eligibility:
          "Open to residents; the source lists no income requirement.",
        accessInstructions: "Call or use the intake form before arriving.",
        phone: "312-555-0100",
        address: "100 Main Street, Chicago, IL",
        enrichment: {
          sourceComparisonCount: 2,
          draft: {
            citations: [
              {
                claimPaths: ["serviceTitle", "description"],
                evidenceSnippet: "Weekly community food pickup.",
                sourceUrl: "https://example.org/resource",
              },
            ],
          },
          verification: {
            status: "approved",
            contradictions: [],
            unsupportedClaims: [],
          },
        },
      },
    } as unknown as ResourceMapAdminImportRecordDetailRow

    const summary = buildResourceMapReviewSummary({
      record,
      evidence: [],
      enrichmentRuns: [],
    })

    expect(summary.readyForHumanApproval).toBe(true)
    expect(summary.blockers).toEqual([])
    expect(summary.citations).toHaveLength(1)

    const blocked = buildResourceMapReviewSummary({
      record: {
        ...record,
        extracted_fields: {
          ...record.extracted_fields,
          eligibility: "",
        },
      },
      evidence: [],
      enrichmentRuns: [],
    })
    expect(blocked.readyForHumanApproval).toBe(false)
    expect(blocked.blockers).toContain("Missing: Eligibility")
    expect(safeResourceMapExternalUrl("javascript:alert(1)")).toBeNull()
    expect(safeResourceMapExternalUrl("https://example.org/resource")).toBe(
      "https://example.org/resource"
    )
  })

  it("keeps resource-map admin mutations server-only, audited, and admin-gated", () => {
    const actions = readSource(
      "src/features/resource-map-admin/server/actions.ts"
    )
    const formActions = readSource(
      "src/features/resource-map-admin/server/form-actions.ts"
    )
    const loaders = readSource(
      "src/features/resource-map-admin/server/loaders.ts"
    )
    const approvalReadiness = readSource(
      "src/features/resource-map-admin/server/approval-readiness.ts"
    )

    expect(actions).toContain('"use server"')
    expect(actions).toContain("await requireAdmin()")
    expect(actions).toContain("createSupabaseAdminClient()")
    expect(actions).toContain("resource_map_curation_events")
    expect(actions).toContain("updateResourceMapCanonicalStateAction")
    expect(actions).toContain("updateResourceMapCanonicalFieldsAction")
    expect(actions).toContain("reviewResourceMapImportRecordAction")
    expect(actions).toContain("setResourceMapPublicVisibilityAction")
    expect(actions).toContain("reviewResourceMapImportMatchAction")
    expect(actions).toContain("markResourceMapImportPromotedAction")
    expect(actions).toContain("assertResourceMapImportReadyForApproval")
    expect(actions).toContain('revalidatePath("/map")')
    expect(actions).toContain('action: "promote"')
    expect(actions).toContain('"contact_visibility"')
    expect(actions).toContain('"link_visibility"')

    expect(loaders).toContain("await requireAdmin()")
    expect(loaders).toContain("resource_map_import_records")
    expect(loaders).toContain("resource_map_import_record_matches")
    expect(loaders).toContain("resource_map_organizations")
    expect(loaders).toContain("canonicalOrganizations")
    expect(loaders).toContain("resource_map_contacts")
    expect(loaders).toContain("resource_map_links")
    expect(loaders).toContain("visibilityContacts")
    expect(loaders).toContain("visibilityLinks")
    expect(loaders).toContain("resource_map_curation_events")
    expect(approvalReadiness).toContain("buildResourceMapReviewSummary")
    expect(approvalReadiness).toContain("resource_map_enrichment_runs")
    expect(approvalReadiness).toContain("pending or accepted duplicate matches")

    expect(formActions).toContain('"use server"')
    expect(formActions).toContain("reviewResourceMapImportRecordFormAction")
    expect(formActions).toContain("reviewResourceMapImportMatchFormAction")
    expect(formActions).toContain("updateResourceMapCanonicalStateFormAction")
    expect(formActions).toContain("updateResourceMapCanonicalFieldsFormAction")
    expect(formActions).toContain("setResourceMapPublicVisibilityFormAction")
    expect(formActions).toContain("markResourceMapImportPromotedFormAction")
    expect(formActions).toContain("confirmDelete")
    expect(formActions).toContain("requires an audit reason")
  })

  it("renders profile hide/delete controls only through the super-admin find surface", () => {
    const findPage = readSource(
      "src/features/find-map/components/public-find-route.tsx"
    )
    const findSlugPage = findPage
    const publicMapIndex = readSource(
      "src/components/public/public-map-index.tsx"
    )
    const resourceDetail = readSource(
      "src/components/public/public-map-index/resource-detail.tsx"
    )
    const resourceChrome = readSource(
      "src/components/public/public-map-index/resource-detail-primary-sections.tsx"
    )
    const resourceAdminActions = readSource(
      "src/components/public/public-map-index/resource-detail-admin-actions.tsx"
    )
    const organizationChrome = readSource(
      "src/components/public/public-map-index/organization-detail-shell-sections.tsx"
    )
    const organizationAdminActions = readSource(
      "src/components/public/public-map-index/organization-detail-admin-actions.tsx"
    )
    const organizationCurationAction = readSource(
      "src/actions/public-map-organization-curation.ts"
    )

    expect(findPage).toContain("canManageResourceMap={shellState.isAdmin}")
    expect(findSlugPage).toContain("canManageResourceMap={shellState.isAdmin}")
    expect(findPage).toContain("updateResourceMapCanonicalStateAction")
    expect(findPage).toContain("resourceMapCurationAction={")
    expect(findSlugPage).toContain("resourceMapCurationAction={")
    expect(publicMapIndex).toContain("canManageResourceMap = false")
    expect(publicMapIndex).toContain("resourceMapCurationAction")
    expect(resourceDetail).toContain("canManageResourceMap?: boolean")
    expect(resourceChrome).toContain("PublicMapResourceAdminActions")
    expect(resourceChrome).toContain("canManageResourceMap &&")
    expect(organizationChrome).toContain("PublicMapOrganizationAdminActions")
    expect(organizationChrome).toContain(
      "canManageResourceMap && organizationCurationAction"
    )

    expect(resourceAdminActions).toContain('"use client"')
    expect(resourceAdminActions).toContain("curationAction")
    expect(resourceAdminActions).toContain('target: "service"')
    expect(resourceAdminActions).toContain('action="hide"')
    expect(resourceAdminActions).toContain('action="delete"')
    expect(resourceAdminActions).toContain(
      "data-public-map-resource-admin-actions"
    )
    expect(resourceAdminActions).toContain("router.refresh()")
    expect(resourceAdminActions).not.toContain("@/features/resource-map-admin")
    expect(resourceAdminActions).not.toContain("resource_map_import_records")
    expect(organizationAdminActions).toContain('"use client"')
    expect(organizationAdminActions).toContain('action="hide"')
    expect(organizationAdminActions).toContain('action="delete"')
    expect(organizationAdminActions).toContain(
      "data-public-map-organization-admin-actions"
    )
    expect(organizationCurationAction).toContain('"use server"')
    expect(organizationCurationAction).toContain("await requireAdmin()")
  })

  it("adds staged ingestion tooling instead of direct public writes", () => {
    const packageJson = readSource("package.json")
    const discoverScript = readSource(
      "scripts/resource-map/discover-sources.mjs"
    )
    const searchPlanScript = readSource(
      "scripts/resource-map/build-source-search-plan.mjs"
    )
    const schemaStatusScript = readSource(
      "scripts/resource-map/check-schema-status.mjs"
    )
    const publicReadSqlScript = readSource(
      "scripts/resource-map/print-public-read-contract-sql.mjs"
    )
    const setupSqlScript = readSource(
      "scripts/resource-map/print-schema-setup-sql.mjs"
    )
    const publicReadSqlPatch = readSource(
      "supabase/migrations/20260626214500_resource_map_public_read_contract_patch.sql"
    )
    const platformOrgAuditPatch = readSource(
      "supabase/migrations/20260626224000_add_public_map_organization_curation_events.sql"
    )
    const availabilityPatch = readSource(
      "supabase/migrations/20260628131000_resource_map_availability_contract.sql"
    )
    const taxonomyPatch = readSource(
      "supabase/migrations/20260628150000_resource_map_taxonomy_categories.sql"
    )
    const dataEnginePatch = readSource(
      "supabase/migrations/20260628162000_resource_map_data_engine_contract.sql"
    )
    const atomicPromotionPatch = readSource(
      "supabase/migrations/20260714201500_resource_map_atomic_promotion.sql"
    )
    const setupSqlOutput = execFileSync(
      process.execPath,
      ["scripts/resource-map/print-schema-setup-sql.mjs"],
      { cwd: ROOT, encoding: "utf8" }
    )
    const importScript = readSource("scripts/resource-map/import-records.mjs")
    const validateLocalScript = readSource(
      "scripts/resource-map/validate-local-records.mjs"
    )
    const recordReader = readSource("scripts/resource-map/lib/read-records.mjs")
    const normalization = readSource(
      "scripts/resource-map/lib/normalization.mjs"
    )
    const promotionPayloads = readSource(
      "scripts/resource-map/lib/promotion-payloads.mjs"
    )
    const promotionNormalizers = readSource(
      "scripts/resource-map/lib/promotion-normalizers.mjs"
    )
    const matchScript = readSource(
      "scripts/resource-map/generate-match-candidates.mjs"
    )
    const reviewMatchesScript = readSource(
      "scripts/resource-map/review-match-candidates.mjs"
    )
    const promoteScript = readSource(
      "scripts/resource-map/promote-approved-records.mjs"
    )
    const reviewImportsScript = readSource(
      "scripts/resource-map/review-import-records.mjs"
    )
    const freshnessScript = readSource(
      "scripts/resource-map/check-source-freshness.mjs"
    )

    expect(packageJson).toContain("resource-map:source-search-plan")
    expect(packageJson).toContain("resource-map:schema-status")
    expect(packageJson).toContain("resource-map:schema-setup-sql")
    expect(packageJson).toContain("resource-map:public-read-sql")
    expect(packageJson).toContain("resource-map:discover-sources")
    expect(packageJson).toContain("resource-map:validate-local")
    expect(packageJson).toContain("resource-map:import")
    expect(packageJson).toContain("resource-map:match")
    expect(packageJson).toContain("resource-map:review-imports")
    expect(packageJson).toContain("resource-map:review-matches")
    expect(packageJson).toContain("resource-map:promote")
    expect(packageJson).toContain("resource-map:source-freshness")

    expect(searchPlanScript).toContain("manualConfirmationRequired")
    expect(searchPlanScript).toContain("publicDisplayAllowed")
    expect(searchPlanScript).toContain("terms/license")
    expect(searchPlanScript).toContain(
      "This plan does not scrape or import data"
    )
    expect(searchPlanScript).toContain("vettedSourceCandidateShape")
    expect(searchPlanScript).not.toContain("createResourceMapAdminClient")
    expect(searchPlanScript).not.toContain("resource_map_public_items")

    expect(schemaStatusScript).toContain("resource_map_public_items")
    expect(schemaStatusScript).toContain("get_resource_map_public_items")
    expect(schemaStatusScript).toContain(
      "public_map_organization_curation_events"
    )
    expect(schemaStatusScript).toContain("geo_point")
    expect(schemaStatusScript).toContain("field_confidence")
    expect(schemaStatusScript).toContain("promotion_status")
    expect(schemaStatusScript).toContain("match_score")
    expect(schemaStatusScript).toContain("hidden_at")
    expect(schemaStatusScript).toContain("suppressed_at")
    expect(schemaStatusScript).toContain("deleted_at")
    expect(schemaStatusScript).toContain("timezone")
    expect(schemaStatusScript).toContain("appointment_required")
    expect(schemaStatusScript).toContain("availability_status")
    expect(schemaStatusScript).toContain("resource_map_ingestion_runs")
    expect(schemaStatusScript).toContain("resource_map_raw_ingestion_records")
    expect(schemaStatusScript).toContain("trust_score")
    expect(schemaStatusScript).toContain("evidence_type")
    expect(schemaStatusScript).toContain("parent_key")
    expect(schemaStatusScript).toContain("SUPABASE_SERVICE_ROLE_KEY")
    expect(schemaStatusScript).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    expect(schemaStatusScript).toContain("Read-only")
    expect(schemaStatusScript).toContain("resource-map:schema-setup-sql")
    expect(schemaStatusScript).toContain("--strict")
    expect(schemaStatusScript).not.toContain("import-records.mjs")
    expect(schemaStatusScript).not.toContain(".insert(")
    expect(schemaStatusScript).not.toContain(".upsert(")
    expect(schemaStatusScript).not.toContain(".update(")
    expect(schemaStatusScript).not.toContain(".delete(")

    expect(publicReadSqlScript).toContain(
      "supabase/migrations/20260626214500_resource_map_public_read_contract_patch.sql"
    )
    expect(publicReadSqlScript).toContain(
      "supabase/migrations/20260628131000_resource_map_availability_contract.sql"
    )
    expect(setupSqlScript).toContain(
      "supabase/migrations/20260626214500_resource_map_public_read_contract_patch.sql"
    )
    expect(setupSqlScript).toContain(
      "supabase/migrations/20260626224000_add_public_map_organization_curation_events.sql"
    )
    expect(setupSqlScript).toContain(
      "supabase/migrations/20260628131000_resource_map_availability_contract.sql"
    )
    expect(setupSqlScript).toContain(
      "supabase/migrations/20260628150000_resource_map_taxonomy_categories.sql"
    )
    expect(setupSqlScript).toContain(
      "supabase/migrations/20260628162000_resource_map_data_engine_contract.sql"
    )
    expect(setupSqlScript).toContain("Resource map schema setup patch")
    expect(setupSqlScript).not.toContain("createClient")
    expect(setupSqlScript).not.toContain(".insert(")
    expect(setupSqlScript).not.toContain(".upsert(")
    expect(setupSqlScript).not.toContain(".update(")
    expect(setupSqlScript).not.toContain(".delete(")
    expect(taxonomyPatch).toContain("'health', 'Health'")
    expect(taxonomyPatch).toContain("'health_dental', 'Dental'")
    expect(taxonomyPatch).toContain("'animals', 'Animals'")
    expect(dataEnginePatch).toContain(
      "create table if not exists public.resource_map_ingestion_runs"
    )
    expect(dataEnginePatch).toContain(
      "create table if not exists public.resource_map_raw_ingestion_records"
    )
    expect(dataEnginePatch).toContain("add column if not exists trust_score")
    expect(dataEnginePatch).toContain("add column if not exists evidence_type")
    expect(setupSqlOutput).toContain(
      "supabase/migrations/20260628162000_resource_map_data_engine_contract.sql"
    )
    expect(setupSqlOutput).toContain(
      "create table if not exists public.resource_map_ingestion_runs"
    )
    expect(setupSqlOutput).toContain(
      "create table if not exists public.resource_map_raw_ingestion_records"
    )
    expect(setupSqlOutput).toContain("add column if not exists trust_score")
    expect(setupSqlOutput).toContain("add column if not exists evidence_type")
    expect(publicReadSqlPatch).toContain(
      "create or replace view public.resource_map_public_items"
    )
    expect(publicReadSqlPatch).toContain(
      "grant execute on function public.get_resource_map_public_items"
    )
    expect(publicReadSqlPatch).toContain(
      "create extension if not exists postgis"
    )
    expect(publicReadSqlPatch).toContain("add column if not exists geo_point")
    expect(platformOrgAuditPatch).toContain(
      "create table if not exists public.public_map_organization_curation_events"
    )
    expect(platformOrgAuditPatch).toContain(
      "public_map_organization_curation_events_admin_manage"
    )
    expect(availabilityPatch).toContain(
      "create or replace view public.resource_map_public_items"
    )
    expect(availabilityPatch).toContain("timezone")
    expect(availabilityPatch).toContain("appointment_required")
    expect(availabilityPatch).toContain("availability_status")
    expect(availabilityPatch).toContain("location_hours")
    expect(publicReadSqlScript).not.toContain("createClient")
    expect(publicReadSqlScript).not.toContain(".insert(")
    expect(publicReadSqlScript).not.toContain(".upsert(")
    expect(publicReadSqlScript).not.toContain(".update(")
    expect(publicReadSqlScript).not.toContain(".delete(")

    expect(discoverScript).toContain("resource_map_sources")
    expect(discoverScript).toContain("discoveryStatus")
    expect(discoverScript).toContain("manualConfirmationRequired")
    expect(discoverScript).toContain("Dry run")
    expect(discoverScript).toContain("--apply")

    expect(importScript).toContain("resource_map_import_records")
    expect(importScript).toContain("resource_map_field_evidence")
    expect(importScript).toContain("readResourceMapRecords")
    expect(importScript).toContain("buildFieldEvidenceRecords")
    expect(importScript).toContain('review_status: "needs_review"')
    expect(importScript).toContain('promotion_status: "not_promoted"')
    expect(importScript).not.toContain("resource_map_public_items")
    expect(recordReader).toContain("parseResourceMapRecords")
    expect(recordReader).toContain("parsed.records")
    expect(recordReader).toContain("parsed.resources")
    expect(recordReader).toContain("parsed.items")
    expect(normalization).toContain("record.extracted_fields")
    expect(validateLocalScript).toContain("RESOURCE_MAP_LOCAL_PREVIEW_FILE")
    expect(validateLocalScript).toContain("pnpm resource-map:import")
    expect(validateLocalScript).not.toContain("createResourceMapAdminClient")
    expect(validateLocalScript).not.toContain("resource_map_public_items")

    expect(matchScript).toContain("resource_map_import_record_matches")
    expect(matchScript).toContain("Re-run with --apply")
    expect(matchScript).toContain("duplicate_match_status")

    expect(reviewMatchesScript).toContain("resource_map_import_record_matches")
    expect(reviewMatchesScript).toContain("resource_map_curation_events")
    expect(reviewMatchesScript).toContain('"accepted"')
    expect(reviewMatchesScript).toContain('"rejected"')
    expect(reviewMatchesScript).toContain('"superseded"')
    expect(reviewMatchesScript).toContain("merge_duplicate")
    expect(reviewMatchesScript).toContain("--reason is required with --apply")
    expect(reviewMatchesScript).toContain("--id is required with --apply")
    expect(reviewMatchesScript).not.toContain("resource_map_public_items")

    expect(reviewImportsScript).toContain("resource_map_import_records")
    expect(reviewImportsScript).toContain("resource_map_curation_events")
    expect(reviewImportsScript).toContain('"approved"')
    expect(reviewImportsScript).toContain('"rejected"')
    expect(reviewImportsScript).toContain('"stale"')
    expect(reviewImportsScript).toContain("--reason is required with --apply")
    expect(reviewImportsScript).toContain("--id is required with --apply")
    expect(reviewImportsScript).not.toContain("resource_map_public_items")

    expect(promoteScript).toContain('review_status", "approved"')
    expect(promoteScript).toContain("fetchAcceptedDuplicateMatch")
    expect(promoteScript).toContain("accepted duplicate matches")
    expect(promoteScript).toContain("promote_resource_map_import_record")
    expect(promoteScript).not.toContain("insertPromotionChildren")
    expect(promoteScript).toContain("--publish")
    expect(atomicPromotionPatch).toContain(
      "create or replace function public.promote_resource_map_import_record"
    )
    expect(atomicPromotionPatch).toContain("promotion_status = 'promoted'")
    expect(atomicPromotionPatch).toContain("promotion_status = 'blocked'")
    expect(atomicPromotionPatch).toContain(
      "insert into public.resource_map_curation_events"
    )
    expect(atomicPromotionPatch).toContain("'merge_duplicate'")
    expect(promotionPayloads).toContain("resource_map_locations")
    expect(promotionPayloads).toContain("resource_map_contacts")
    expect(promotionPayloads).toContain("resource_map_links")
    expect(promotionPayloads).toContain("resource_map_service_categories")
    expect(promotionPayloads).toContain("appointment_required")
    expect(promotionPayloads).toContain("availability_status")
    expect(promotionPayloads).toContain("temporary_closed_until")
    expect(promotionPayloads).toContain("is_public: false")
    expect(promotionPayloads).toContain("categoryKeys")
    expect(promotionPayloads).toContain("buildCanonicalPayload")
    expect(promotionNormalizers).toContain("RESOURCE_CATEGORY_KEYS")
    expect(promotionNormalizers).toContain("CONTACT_TYPES")
    expect(promotionNormalizers).toContain("LINK_TYPES")

    expect(freshnessScript).toContain("resource_map_sources")
    expect(freshnessScript).toContain("resource_map_import_batches")
    expect(freshnessScript).toContain("resource_map_import_records")
    expect(freshnessScript).toContain("stale")
    expect(freshnessScript).not.toContain("resource_map_public_items")
  })

  it("keeps resource-map RLS coverage extracted from the monolithic runner", () => {
    const runner = readSource("supabase/tests/rls.test.mjs")
    const resourceMapRls = readSource("supabase/tests/resource-map-rls.mjs")

    expect(runner).toContain("runResourceMapRlsTests")
    expect(runner).not.toContain("resource_map_")
    expect(resourceMapRls).toContain("resource_map_import_records")
    expect(resourceMapRls).toContain("resource_map_curation_events")
    expect(resourceMapRls).toContain("public_map_organization_curation_events")
    expect(resourceMapRls).toContain(
      "authenticated non-admin cannot write public map organization curation events"
    )
    expect(resourceMapRls).toContain("resource_map_public_items")
    expect(resourceMapRls).toContain("get_resource_map_public_items")
    expect(resourceMapRls).toContain("hidden suppressed and deleted")
    expect(resourceMapRls.split(/\r?\n/).length).toBeLessThanOrEqual(450)
  })

  it("adds an evidence-first admin review surface without removing /find curation", () => {
    const featureIndex = readSource("src/features/resource-map-admin/index.ts")
    const routeApi = readSource("src/features/resource-map-admin/route-api.ts")
    const reviewRoute = readSource(
      "src/app/(admin)/admin/platform/resource-map/page.tsx"
    )
    const reviewPage = readSource(
      "src/features/resource-map-admin/components/resource-map-admin-review-page.tsx"
    )
    const reviewRecord = readSource(
      "src/features/resource-map-admin/components/resource-map-review-record.tsx"
    )
    const reviewEvidence = readSource(
      "src/features/resource-map-admin/components/resource-map-review-evidence.tsx"
    )
    const reviewAiEvidence = readSource(
      "src/features/resource-map-admin/components/resource-map-review-ai-evidence.tsx"
    )
    const reviewVisibility = readSource(
      "src/features/resource-map-admin/components/resource-map-review-visibility.tsx"
    )
    const reviewActions = readSource(
      "src/features/resource-map-admin/components/resource-map-review-actions.tsx"
    )
    const loaders = readSource(
      "src/features/resource-map-admin/server/loaders.ts"
    )
    const findPage = readSource(
      "src/features/find-map/components/public-find-route.tsx"
    )
    const findSlugPage = findPage

    expect(
      existsSync(
        join(ROOT, "src/app/(admin)/admin/platform/resource-map/page.tsx")
      )
    ).toBe(true)
    expect(
      existsSync(
        join(
          ROOT,
          "src/app/(admin)/@breadcrumbs/admin/platform/resource-map/page.tsx"
        )
      )
    ).toBe(true)
    expect(
      existsSync(
        join(
          ROOT,
          "src/features/resource-map-admin/components/resource-map-admin-review-page.tsx"
        )
      )
    ).toBe(true)

    expect(featureIndex).toContain("ResourceMapAdminReviewPage")
    expect(featureIndex).not.toContain("ResourceMapAdminPanel")
    expect(featureIndex).toContain("loadResourceMapAdminReviewQueue")
    expect(featureIndex).toContain("loadResourceMapAdminReviewRecord")
    expect(reviewRoute).toContain("ResourceMapAdminReviewPage")
    expect(reviewRoute).toContain("redirect(")
    expect(reviewRoute).toContain("offset: (page - 1) * pageSize")
    expect(reviewPage).toContain("Evidence-First Review")
    expect(reviewPage).toContain("Resource Map Review")
    expect(reviewPage).toContain("Previous Page")
    expect(reviewPage).toContain("Next Page")
    expect(reviewRecord).toContain("Reviewing as")
    expect(reviewRecord).toContain("Duplicate Review Blocks Approval")
    expect(reviewEvidence).toContain("Source Vs Extracted Values")
    expect(reviewAiEvidence).toContain("AI Draft And Citations")
    expect(reviewAiEvidence).toContain("Verification Passes")
    expect(reviewVisibility).toContain("Private By Default")
    expect(reviewActions).toContain("Make Public")
    expect(reviewActions).toContain("Keep Private")
    expect(reviewActions).toContain("useActionState")
    expect(reviewActions).toContain("beforeunload")
    expect(reviewActions).toContain("onNavigate")
    expect(loaders).toContain("resource_map_field_evidence")
    expect(loaders).toContain("resource_map_enrichment_runs")
    expect(loaders).toContain("isMissingEnrichmentLedgerError")
    expect(loaders).toContain('{ count: "exact" }')
    expect(loaders).toContain(".range(normalizedOffset")
    expect(routeApi).toContain("updateResourceMapCanonicalStateAction")
    expect(routeApi).toContain("FormAction")
    expect(routeApi).toContain("loadResourceMapAdminReviewQueue")

    expect(findPage).toContain("canManageResourceMap={shellState.isAdmin}")
    expect(findSlugPage).toContain("canManageResourceMap={shellState.isAdmin}")
    expect(findPage).toContain("resourceMapCurationAction={")
    expect(findPage).toContain("organizationCurationAction={")
  })
})
