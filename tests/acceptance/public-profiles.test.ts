import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

import {
  normalizePublicHandle,
  RESERVED_PUBLIC_HANDLES,
  validatePublicHandle,
} from "@/features/public-profiles"
import { groupContinuous } from "@/components/heatmap/calendar-heatmap-model"

function readSource(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8")
}

describe("public-profiles feature contract", () => {
  it("normalizes and validates one shared public handle format", () => {
    expect(normalizePublicHandle("  @Caleb-Hamernick ")).toBe("caleb-hamernick")
    expect(validatePublicHandle("caleb")).toEqual({
      code: "available",
      handle: "caleb",
      valid: true,
    })
    expect(validatePublicHandle("-caleb").code).toBe("invalid")
    expect(validatePublicHandle("caleb--hamernick").code).toBe("invalid")
    expect(validatePublicHandle("find").code).toBe("reserved")
    expect(validatePublicHandle("privacy").code).toBe("reserved")
    expect(validatePublicHandle("terms").code).toBe("reserved")
    expect(validatePublicHandle("callback").code).toBe("reserved")
    expect(RESERVED_PUBLIC_HANDLES.has("go")).toBe(true)
  })

  it("defines a private public projection and globally unique owners", () => {
    const migration = readSource(
      "supabase/migrations/20260831213000_add_public_profile_foundation.sql"
    )

    expect(migration).toContain(
      "create table if not exists public.public_handles"
    )
    expect(migration).toContain("handle text primary key")
    expect(migration).toContain("profile_id uuid unique")
    expect(migration).toContain("organization_id uuid unique")
    expect(migration).toContain("is_public boolean not null default false")
    expect(migration).toContain("force row level security")
    expect(migration).toContain("claim_person_public_handle")
    expect(migration).toContain("save_public_person_profile")
    expect(migration).toContain("sync_organization_public_handle")
    expect(migration).toContain("'go', 'Tracked short-link route'")
  })

  it("keeps the planned profile minimal and privacy explicit", () => {
    const design = readSource(
      "docs/plans/2026-08-31-public-impact-profiles-design.md"
    )

    expect(design).toContain("centered, quiet, and single-column")
    expect(design).toContain("CalendarHeatmap")
    expect(design).toContain("There is no X/Y contribution chart")
    expect(design).toContain("Person profiles are private by default")
    expect(design).toContain("`coachhouse.app/go/<code>`")
  })

  it("registers database types and controlled server writes", () => {
    const tables = readSource("src/lib/supabase/schema/tables/index.ts")
    const functions = readSource("src/lib/supabase/schema/functions.ts")
    const actions = readSource("src/features/public-profiles/server/actions.ts")

    expect(tables).toContain("public_handles: PublicHandlesTable")
    expect(tables).toContain(
      "public_person_profiles: PublicPersonProfilesTable"
    )
    expect(functions).toContain("claim_person_public_handle")
    expect(functions).toContain("save_public_person_profile")
    expect(actions).toContain("claimPersonPublicHandleAction")
    expect(actions).toContain("savePublicPersonProfileAction")
  })

  it("claims usernames during account setup and exposes later editing", () => {
    const accountStep = readSource(
      "src/components/onboarding/onboarding-dialog/components/account-step.tsx"
    )
    const onboardingAction = readSource(
      "src/app/(dashboard)/onboarding/actions.ts"
    )
    const identitySettings = readSource(
      "src/features/public-profiles/components/public-profile-identity-settings.tsx"
    )

    expect(accountStep).toContain("coachhouse.app/")
    expect(accountStep).toContain('autoComplete="username"')
    expect(accountStep).toContain("Your profile stays private")
    expect(onboardingAction).toContain('form.get("personHandle")')
    expect(onboardingAction).toContain("claim_person_public_handle")
    expect(identitySettings).toContain("Public page")
    expect(identitySettings).toContain('fetch("/api/account/public-handle"')
    expect(identitySettings).toContain(
      "Choose your Coach House address and decide when people can view it."
    )
    expect(identitySettings).toContain("setPublicProfileVisibilityAction")
    expect(identitySettings).toContain("Visibility")
    expect(identitySettings).toContain("Profile unpublished")
  })

  it("unifies personal and public profile management", () => {
    const tabTypes = readSource("src/components/account-settings/types.ts")
    const shell = readSource(
      "src/components/account-settings/account-settings-dialog-shell.tsx"
    )
    const profileFields = readSource(
      "src/components/account-settings/sections/profile-fields.tsx"
    )
    const profileSection = readSource(
      "src/components/account-settings/sections/profile-section.tsx"
    )
    const navUser = readSource("src/components/nav-user.tsx")
    const accountMenu = readSource(
      "src/components/nav-user/nav-user-menu-content.tsx"
    )
    const publicProfileSettings = readSource(
      "src/features/public-profiles/components/public-profile-settings.tsx"
    )
    const identitySettings = readSource(
      "src/features/public-profiles/components/public-profile-identity-settings.tsx"
    )

    expect(tabTypes).not.toContain('| "public-profile"')
    expect(shell).not.toContain('label="Public profile"')
    expect(shell).not.toContain('tab === "public-profile"')
    expect(shell).toContain("<ProfileSection")
    expect(shell).toContain("onDone={requestClose}")
    expect(shell).not.toContain("onDone={() => onOpenChange(false)}")
    expect(profileSection).toContain("<PublicProfileSettings")
    expect(profileFields).not.toContain("PublicProfileIdentitySettings")
    expect(profileFields).toContain("Personal details")
    expect(profileFields).toContain("Private")
    expect(navUser).toContain("initialTab={settingsInitialTab}")
    expect(accountMenu).not.toContain('onOpenSettings("public-profile")')
    expect(accountMenu).toContain("Profile & settings")
    expect(publicProfileSettings).not.toContain(">Public profile<")
    expect(publicProfileSettings).toContain("profileDetails")
    expect(publicProfileSettings).toContain("PublicProfileAffiliationSettings")
    expect(publicProfileSettings).toContain(
      "PublicProfileSavedCollectionSettings"
    )
    expect(identitySettings.indexOf("{profileDetails}")).toBeLessThan(
      identitySettings.indexOf("Public page")
    )
    const preview = readSource(
      "src/features/public-profiles/components/public-profile-identity-preview.tsx"
    )
    expect(preview).toContain("View profile")
    expect(preview).toContain("Save your changes before viewing your profile.")
    expect(identitySettings).not.toContain("<Card")
    expect(identitySettings).toContain(
      "onCheckedChange={(checked) => void saveVisibility(checked)}"
    )
    expect(publicProfileSettings).toContain("profileDetails={profileDetails}")
  })

  it("checks organization URLs against the same global namespace", () => {
    const organizationAvailability = readSource(
      "src/app/api/public/organizations/slug-available/route.ts"
    )

    expect(organizationAvailability).toContain("validatePublicHandle")
    expect(organizationAvailability).toContain("public_handle_availability")
    expect(organizationAvailability).toContain("resolveActiveOrganization")
  })

  it("installs the requested shadcn calendar heatmap behind a stable barrel", () => {
    const barrel = readSource("src/components/heatmap/calendar-heatmap.tsx")
    const model = readSource("src/components/heatmap/calendar-heatmap-model.ts")

    expect(barrel).toContain("CalendarHeatmap")
    expect(barrel).toContain("CalendarHeatmapLegend")
    expect(model).toContain('from "date-fns"')
    expect(model).toContain("color-mix(in oklch")
    expect(
      groupContinuous(
        [
          { date: "2025-12-31", value: 1, level: 1 },
          { date: "2026-01-01", value: 1, level: 1 },
        ],
        1
      )
    ).toHaveLength(1)
  })

  it("publishes only verified affiliations and allowlisted activity", () => {
    const migration = readSource(
      "supabase/migrations/20260901012000_add_public_profile_affiliations_activity.sql"
    )
    const affiliationSettings = readSource(
      "src/features/public-profiles/components/public-profile-affiliation-settings.tsx"
    )
    const accountApi = readSource(
      "src/app/api/account/public-affiliations/route.ts"
    )

    expect(migration).toContain(
      "create table if not exists public.public_person_organization_affiliations"
    )
    expect(migration).toContain(
      "create table if not exists public.public_profile_activity_events"
    )
    expect(migration).toContain("set_person_public_affiliation")
    expect(migration).toContain("event_kind in ('affiliation_published')")
    expect(migration).toContain("sync_public_person_affiliation_membership")
    expect(affiliationSettings).toContain(
      'fetch("/api/account/public-affiliations"'
    )
    expect(accountApi).toContain("set_person_public_affiliation")
    expect(accountApi).toContain(
      "new Set([user.id, ...(membershipRows ?? []).map"
    )
    expect(affiliationSettings).toContain("verified memberships")
    expect(affiliationSettings).toContain("organizationIsPublic")
  })

  it("creates bounded privacy-safe tracked resource links", () => {
    const migration = readSource(
      "supabase/migrations/20260901013000_add_tracked_resource_links.sql"
    )
    const shareApi = readSource(
      "src/app/api/account/public-share-links/route.ts"
    )
    const redirect = readSource("src/app/go/[code]/route.ts")
    const resolver = readSource(
      "src/lib/queries/public-profile-tracked-links.ts"
    )
    const resourceChrome = readSource(
      "src/components/public/public-map-index/resource-detail-primary-sections.tsx"
    )

    expect(migration).toContain(
      "create table if not exists public.public_tracked_resource_links"
    )
    expect(migration).toContain(
      "create table if not exists public.public_tracked_resource_link_daily_opens"
    )
    expect(migration).toContain(">= 10000")
    expect(migration).toContain("force row level security")
    expect(migration).not.toContain("ip_address")
    expect(shareApi).toContain("createTrackedResourceLink")
    expect(resolver).toContain("fetchPublicResourceMapItemById")
    expect(resolver).toContain("shouldShowPublicMapResourceLink")
    expect(redirect).toContain('createHash("sha256")')
    expect(redirect).toContain("coach_house_share_visitor")
    expect(redirect).not.toContain("x-forwarded-for")
    expect(resourceChrome).toContain("TrackedResourceShareButton")
  })

  it("publishes only explicitly curated saved Find collections", () => {
    const migration = readSource(
      "supabase/migrations/20260901014000_add_public_saved_collections.sql"
    )
    const accountApi = readSource(
      "src/app/api/account/public-saved-collections/route.ts"
    )
    const settings = readSource(
      "src/features/public-profiles/components/public-profile-saved-collection-settings.tsx"
    )
    const editor = readSource(
      "src/features/public-profiles/components/public-profile-saved-collection-editor.tsx"
    )
    const readModel = readSource(
      "src/lib/queries/public-profile-saved-collections.ts"
    )

    expect(migration).toContain(
      "create table if not exists public.public_person_saved_collections"
    )
    expect(migration).toContain(
      "create table if not exists public.public_person_saved_collection_items"
    )
    expect(migration).toContain("force row level security")
    expect(migration).toContain("v_item_count > 24")
    expect(migration).toContain(">= 12")
    expect(migration).toContain("save_person_public_saved_collection")
    expect(migration).toContain("delete_person_public_saved_collection")
    expect(accountApi).toContain("user.user_metadata")
    expect(accountApi).toContain(
      "Collections can contain only resources saved in Find."
    )
    expect(settings).toContain("personal map preferences stay")
    expect(settings).toContain("private.")
    expect(editor).toContain("Show on profile")
    expect(readModel).toContain("fetchPublicResourceMapItemsByIds")
    expect(readModel).toContain('.eq("is_public", true)')
  })

  it("resolves published people and organizations at the root handle route", () => {
    const route = readSource("src/app/[org]/page.tsx")
    const readModel = readSource("src/lib/queries/public-profile.ts")
    const profilePage = readSource(
      "src/features/public-profiles/components/public-profile-page.tsx"
    )

    expect(route).toContain("fetchPublicProfileByHandle")
    expect(route).toContain("if (profile) return <PublicProfilePage")
    expect(route).toContain("findLegacyPublicOrganizationSlug")
    expect(readModel).toContain('.eq("is_public", true)')
    expect(readModel).toContain("safeHttpUrl")
    expect(readModel).toContain("buildPublicActivityHeatmap")
    expect(readModel).toContain("public_profile_activity_events")
    expect(readModel).toContain("public_tracked_resource_links")
    expect(readModel).toContain("resourceOpens")
    expect(readModel).toContain("fetchPersonPublicSavedCollections")
    expect(readModel).toContain("fetchPublicOrganizationPeople")
    expect(readModel).toContain("PUBLIC_ORGANIZATION_PERSON_ROLE_LABELS")
    expect(readModel).not.toContain("person.email")
    expect(profilePage).toContain('id="public-profile-people"')
    expect(profilePage).toContain("Staff and board members added")
    expect(profilePage).toContain('id="public-profile-activity"')
    expect(profilePage).not.toContain("Program activity")
    expect(profilePage).toContain("WorkspaceActivityCard")
    expect(profilePage).toContain("PublicProfileActivityHeatmap")
    expect(profilePage).toContain("Verified organizations this person")
    expect(profilePage).toContain('label="Donate"')
    expect(profilePage).toContain("Published ways to participate, apply")
  })

  it("lets organizations add a public donation destination", () => {
    const presence = readSource(
      "src/components/organization/org-profile-card/tabs/company-tab/edit-sections/presence.tsx"
    )
    const publicHeader = readSource(
      "src/components/organization/org-profile-card/public-card-header.tsx"
    )
    const publicMapQuery = readSource("src/lib/queries/public-map-index.ts")

    expect(presence).toContain('name: "donateUrl"')
    expect(presence).toContain("Adds a Donate button")
    expect(publicHeader).toContain("profile.donateUrl")
    expect(publicHeader).toContain("Donate")
    expect(publicMapQuery).toContain('"donateUrl"')
  })
})
