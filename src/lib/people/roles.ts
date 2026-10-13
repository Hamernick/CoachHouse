import { PERSON_CATEGORY_OPTIONS, type PersonCategory } from "./categories"

export type PersonRole = {
  category: PersonCategory
  customRole?: string | null
}
export type PersonRoleFilterValue = PersonCategory | "all" | `custom:${string}`

export function personMatchesRole(
  person: PersonRole,
  filter: PersonRoleFilterValue
): boolean {
  return (
    filter === "all" ||
    (filter.startsWith("custom:")
      ? normalizeRoleLabel(person.customRole).toLowerCase() ===
        filter.slice(7).toLowerCase()
      : person.category === filter)
  )
}

export const MAX_PERSON_ROLE_LENGTH = 60

export function normalizeRoleLabel(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : ""
}

export function readPeopleRoles(profile: Record<string, unknown>): string[] {
  const stored = Array.isArray(profile.people_roles) ? profile.people_roles : []
  const people = Array.isArray(profile.org_people) ? profile.org_people : []
  const labels = [
    ...stored,
    ...people.map((person) =>
      person && typeof person === "object" ? person.customRole : null
    ),
  ]
  const unique = new Map<string, string>()
  for (const value of labels) {
    const label = normalizeRoleLabel(value)
    if (label && label.length <= MAX_PERSON_ROLE_LENGTH)
      unique.set(label.toLowerCase(), label)
  }
  return [...unique.values()].sort((a, b) => a.localeCompare(b))
}

export function resolvePersonRole(
  role: PersonRole,
  roles: string[]
): PersonRole | { error: string } {
  if (
    !PERSON_CATEGORY_OPTIONS.some((option) => option.value === role.category)
  ) {
    return { error: "Choose a valid role." }
  }
  if (role.customRole != null && typeof role.customRole !== "string") {
    return { error: "Choose a valid role." }
  }
  const label = normalizeRoleLabel(role.customRole)
  if (
    label.length > MAX_PERSON_ROLE_LENGTH ||
    /[\u0000-\u001f\u007f]/.test(label)
  ) {
    return { error: "Use a role name of 60 characters or fewer." }
  }
  if (!label) return { category: role.category, customRole: null }
  const existing = PERSON_CATEGORY_OPTIONS.find(
    (option) =>
      option.label.toLowerCase() === label.toLowerCase() ||
      option.value === label.toLowerCase()
  )
  if (existing) return { category: existing.value, customRole: null }
  return {
    category: role.category,
    customRole:
      roles.find((value) => value.toLowerCase() === label.toLowerCase()) ??
      label,
  }
}

export function personRoleLabel(person: PersonRole): string {
  return (
    normalizeRoleLabel(person.customRole) ||
    PERSON_CATEGORY_OPTIONS.find((option) => option.value === person.category)
      ?.label ||
    person.category
  )
}
