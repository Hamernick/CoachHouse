import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const ROOT = process.cwd()

function readSource(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8")
}

describe("public map organization curation", () => {
  it("refreshes cached public organizations after profile changes", () => {
    const organizationAction = readSource("src/actions/organization.ts")
    const publicMapQuery = readSource("src/lib/queries/public-map-index.ts")

    expect(organizationAction).toContain(
      'revalidateTag("public-map-organizations", { expire: 0 })'
    )
    expect(publicMapQuery).toContain('["public-map-organizations-v9"]')
  })

  it("uses an admin-gated unpublish action instead of deleting org data", () => {
    const action = readSource("src/actions/public-map-organization-curation.ts")
    const migration = readSource(
      "supabase/migrations/20260626224000_add_public_map_organization_curation_events.sql"
    )
    const schemaIndex = readSource("src/lib/supabase/schema/tables/index.ts")
    const tableType = readSource(
      "src/lib/supabase/schema/tables/public_map_organization_curation_events.ts"
    )

    expect(action).toContain('"use server"')
    expect(action).toContain("await requireAdmin()")
    expect(action).toContain("createSupabaseAdminClient()")
    expect(action).toContain('.from("organizations")')
    expect(action).toContain('.select("user_id, public_slug, is_public")')
    expect(action).toContain(".update({ is_public: false })")
    expect(action).toContain('.from("public_map_organization_curation_events")')
    expect(action).toContain("actor_id: userId")
    expect(action).toContain("before_state")
    expect(action).toContain("after_state")
    expect(action).toContain('revalidateTag("public-map-organizations", "max")')
    expect(action).toContain('revalidatePath("/map")')
    expect(action).not.toContain(".delete(")

    expect(migration).toContain(
      "create table if not exists public.public_map_organization_curation_events"
    )
    expect(migration).toContain(
      "organization_id uuid references public.organizations(user_id) on delete set null"
    )
    expect(migration).toContain("check (action in ('hide', 'delete'))")
    expect(migration).toContain(
      "alter table public.public_map_organization_curation_events force row level security"
    )
    expect(migration).toContain(
      'create policy "public_map_organization_curation_events_admin_manage"'
    )
    expect(schemaIndex).toContain("PublicMapOrganizationCurationEventsTable")
    expect(schemaIndex).toContain("public_map_organization_curation_events:")
    expect(tableType).toContain("organization_id: string | null")
    expect(tableType).toContain("before_state: Json")
    expect(tableType).toContain("after_state: Json")
  })

  it("passes org curation only through the authenticated super-admin find shell", () => {
    const findPage = readSource(
      "src/features/find-map/components/public-find-route.tsx"
    )
    const findSlugPage = findPage
    const publicMapIndex = readSource(
      "src/components/public/public-map-index.tsx"
    )
    const organizationHeaderSlots = readSource(
      "src/components/public/public-map-index/organization-detail-header-slots.tsx"
    )
    const organizationChrome = readSource(
      "src/components/public/public-map-index/organization-detail-shell-sections.tsx"
    )
    const organizationAdminActions = readSource(
      "src/components/public/public-map-index/organization-detail-admin-actions.tsx"
    )

    expect(findPage).toContain("canManageResourceMap={shellState.isAdmin}")
    expect(findPage).toContain("updatePublicMapOrganizationCurationAction")
    expect(findPage).toContain("organizationCurationAction={")
    expect(findSlugPage).toContain("organizationCurationAction={")
    expect(publicMapIndex).toContain("organizationCurationAction")
    expect(organizationHeaderSlots).toContain(
      "canManageResourceMap={canManageResourceMap}"
    )
    expect(organizationHeaderSlots).toContain(
      "organizationCurationAction={organizationCurationAction}"
    )
    expect(organizationChrome).toContain("canManageResourceMap?: boolean")
    expect(organizationChrome).toContain("organizationCurationAction")
    expect(organizationChrome).toContain("PublicMapOrganizationAdminActions")
    expect(organizationChrome).toContain(
      "canManageResourceMap && organizationCurationAction"
    )

    expect(organizationAdminActions).toContain('"use client"')
    expect(organizationAdminActions).toContain(
      "data-public-map-organization-admin-actions"
    )
    expect(organizationAdminActions).toContain('action="hide"')
    expect(organizationAdminActions).toContain('action="delete"')
    expect(organizationAdminActions).toContain("router.refresh()")
    expect(organizationAdminActions).toContain(
      "It does not delete the workspace, account, or organization record."
    )
    expect(organizationAdminActions).not.toContain(
      "@/features/resource-map-admin"
    )
    expect(organizationAdminActions).not.toContain(".delete(")
  })
})
