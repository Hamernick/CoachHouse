export type OrganizationCoachScopeStatus = {
  available: boolean
  assignedOnlyEnabled: boolean
  activatedAt: string | null
}

export type OrganizationCoachActorScope =
  | { mode: "all"; canAccessAll?: boolean }
  | {
      mode: "assigned"
      organizationIds: ReadonlySet<string>
      canAccessUnassigned?: boolean
    }

export const ALL_ORGANIZATION_COACH_SCOPE: OrganizationCoachActorScope = {
  mode: "all",
}

export function canAccessOrganizationInCoachScope(
  scope: OrganizationCoachActorScope | null | undefined,
  organizationId: string
) {
  return (
    !scope || scope.mode === "all" || scope.organizationIds.has(organizationId)
  )
}

export function filterByOrganizationCoachScope<T extends { orgId: string }>(
  values: T[],
  scope: OrganizationCoachActorScope | null | undefined
) {
  if (!scope || scope.mode === "all") return values
  return values.filter((value) => scope.organizationIds.has(value.orgId))
}
