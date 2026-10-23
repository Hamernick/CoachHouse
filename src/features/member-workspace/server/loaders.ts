import type { OrgPerson } from "@/actions/people"
import {
  attachCanonicalProjectIdsToOrganizations,
  ensureCanonicalAdminProjects,
} from "@/features/member-workspace/server/admin-projects"
import { loadAdminOrganizationSummaries } from "@/features/member-workspace/server/admin-organization-overview"
import { resolveOptionalAuthenticatedAppContext } from "@/lib/auth/request-context"
import { normalizePersonCategory } from "@/lib/people/categories"
import { resolvePeopleDisplayImages } from "@/lib/people/display-images"
import { canEditOrganization } from "@/lib/organization/active-org"
import type { MemberWorkspacePeoplePageData } from "../types"
export { loadMemberWorkspaceProjectsPage } from "./project-loaders"
export { loadMemberWorkspaceTasksPage } from "./task-loaders"

export async function loadMemberWorkspacePeoplePage(): Promise<MemberWorkspacePeoplePageData> {
  const requestContext = await resolveOptionalAuthenticatedAppContext()

  if (!requestContext) {
    return {
      mode: "organization",
      people: [],
      canEdit: false,
    }
  }

  const { supabase, user, profileAudience, activeOrg } = requestContext

  if (profileAudience.isAdmin && !activeOrg.supportAccess) {
    const baseOrganizations = await loadAdminOrganizationSummaries({
      supabase,
    })
    const canonicalProjects = await ensureCanonicalAdminProjects({
      organizations: baseOrganizations,
      supabase,
    })
    const organizations = attachCanonicalProjectIdsToOrganizations({
      organizations: baseOrganizations,
      canonicalProjects,
    })

    return {
      mode: "platform-admin",
      organizations,
      summary: {
        organizationCount: organizations.length,
        memberCount: organizations.reduce(
          (total, organization) => total + organization.memberCount,
          0
        ),
      },
    }
  }

  const { orgId, role } = activeOrg
  const canEdit = canEditOrganization(role)

  const { data: org } = await supabase
    .from("organizations")
    .select("profile")
    .eq("user_id", orgId)
    .maybeSingle<{ profile: Record<string, unknown> | null }>()

  const profile = (org?.profile ?? {}) as Record<string, unknown>
  const peopleRaw = (
    Array.isArray(profile.org_people) ? profile.org_people : []
  ) as OrgPerson[]

  if (org && !activeOrg.supportAccess) {
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("full_name, headline, avatar_url")
      .eq("id", user.id)
      .maybeSingle<{
        full_name: string | null
        headline: string | null
        avatar_url: string | null
      }>()

    const derivedName =
      typeof profileRow?.full_name === "string" &&
      profileRow.full_name.trim().length > 0
        ? profileRow.full_name.trim()
        : typeof user.user_metadata?.full_name === "string" &&
            user.user_metadata.full_name.trim().length > 0
          ? user.user_metadata.full_name.trim()
          : null

    const membershipCategory = role === "board" ? "governing_board" : "staff"
    const synchronizeSelf = (people: OrgPerson[]) => {
      const selfIndex = people.findIndex((person) => person?.id === user.id)
      const selfExisting = selfIndex > -1 ? people[selfIndex] : null
      const nextSelf: OrgPerson = {
        ...selfExisting,
        id: user.id,
        name: derivedName ?? selfExisting?.name ?? "You",
        title:
          (typeof profileRow?.headline === "string" &&
          profileRow.headline.trim().length > 0
            ? profileRow.headline.trim()
            : null) ??
          selfExisting?.title ??
          null,
        email: user.email ?? selfExisting?.email ?? null,
        category: membershipCategory,
        image: profileRow?.avatar_url ?? selfExisting?.image ?? null,
        reportsToId: selfExisting?.reportsToId ?? null,
        pos: selfExisting?.pos ?? null,
      }
      const nextPeople = [...people]
      if (selfIndex > -1) nextPeople[selfIndex] = nextSelf
      else nextPeople.push(nextSelf)

      const ownerIndex = nextPeople.findIndex((person) => person?.id === orgId)
      if (ownerIndex > 0) {
        const [owner] = nextPeople.splice(ownerIndex, 1)
        nextPeople.unshift(owner)
      }

      return {
        changed:
          selfIndex === -1 ||
          (selfExisting?.name ?? null) !== (nextSelf.name ?? null) ||
          (selfExisting?.title ?? null) !== (nextSelf.title ?? null) ||
          (selfExisting?.email ?? null) !== (nextSelf.email ?? null) ||
          (selfExisting?.image ?? null) !== (nextSelf.image ?? null) ||
          (selfExisting?.category ?? null) !== (nextSelf.category ?? null) ||
          ownerIndex > 0,
        people: nextPeople,
      }
    }

    const sync = synchronizeSelf(peopleRaw)
    if (sync.changed) peopleRaw.splice(0, peopleRaw.length, ...sync.people)
  }

  const normalizedPeople = peopleRaw.map((person) => ({
    ...person,
    category: normalizePersonCategory(person.category),
  }))

  return {
    mode: "organization",
    people: await resolvePeopleDisplayImages(normalizedPeople),
    canEdit,
  }
}
