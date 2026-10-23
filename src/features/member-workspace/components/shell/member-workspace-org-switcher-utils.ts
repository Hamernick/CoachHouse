import type { MemberWorkspaceAccessibleOrganization } from "../../types"

export function formatRole(role: MemberWorkspaceAccessibleOrganization["role"]) {
  if (role === "owner") return "Owner"
  if (role === "admin") return "Admin"
  if (role === "staff") return "Staff"
  if (role === "board") return "Board"
  return "Member"
}

export function getOrganizationInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

