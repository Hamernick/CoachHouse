export type PublicHandleResult =
  | { ok: true; code: "claimed"; handle: string }
  | { ok: false; code: "invalid" | "reserved" | "taken"; error: string }

export type PublicPersonProfileInput = {
  displayName: string
  headline: string | null
  bio: string | null
  locationLabel: string | null
  websiteUrl: string | null
  avatarUrl: string | null
  isPublic: boolean
  showOrganizations: boolean
  showProgramActivity: boolean
  showSavedLocations: boolean
}

export type PublicPersonProfileSaveResult =
  | { ok: true; code: "saved" }
  | { ok: false; code: "invalid" | "handle_required"; error: string }

export type PublicProfileProgram = {
  id: string
  title: string
  summary: string | null
  statusLabel: string | null
  startDate: string | null
  locationLabel: string | null
  ctaLabel: string | null
  ctaUrl: string | null
}

export type PublicProfileAffiliation = {
  organizationId: string
  name: string
  handle: string
  role: "owner" | "admin" | "staff" | "board" | "member"
  avatarUrl: string | null
  href: string
}

export type PublicOrganizationProfilePerson = {
  id: string
  name: string
  title: string | null
  roleLabel: "Staff" | "Governing Board" | "Advisory Board"
  avatarUrl: string | null
}

export type PublicProfileActivityEvent = {
  id: string
  kind: "affiliation_published" | "resource_shared"
  title: string
  summary: string | null
  occurredAt: string
  relatedLabel: string
  relatedHref: string
}

export type PublicProfileHeatmapDay = {
  date: string
  value: number
}

export type PublicProfileSavedItem = {
  kind: "organization" | "resource"
  id: string
  title: string
  subtitle: string | null
  locationLabel: string | null
  href: string
}

export type PublicProfileSavedCollection = {
  id: string
  name: string
  isPublic: boolean
  items: PublicProfileSavedItem[]
}

type PublicProfileIdentity = {
  handle: string
  displayName: string
  headline: string | null
  description: string | null
  avatarUrl: string | null
  locationLabel: string | null
  websiteUrl: string | null
}

export type PublicPersonProfileView = PublicProfileIdentity & {
  kind: "person"
  showOrganizations: boolean
  showProgramActivity: boolean
  showSavedLocations: boolean
  affiliations: PublicProfileAffiliation[]
  activity: PublicProfileActivityEvent[]
  heatmap: PublicProfileHeatmapDay[]
  resourcesShared: number
  resourceOpens: number
  savedCollections: PublicProfileSavedCollection[]
  savedItems: number
}

export type PublicOrganizationProfileView = PublicProfileIdentity & {
  kind: "organization"
  organization?: PublicMapOrganization
  organizationId: string
  donateUrl: string | null
  findUrl: string
  people: PublicOrganizationProfilePerson[]
  programs: PublicProfileProgram[]
}

export type PublicProfileView =
  | PublicPersonProfileView
  | PublicOrganizationProfileView
import type { PublicMapOrganization } from "@/lib/queries/public-map-index"
