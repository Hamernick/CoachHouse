import type { PublicMapOrganization } from "@/lib/public-map/organization-projection"

export type OrganizationLaunchInput = {
  name?: string | null
  publicSlug?: string | null
  description?: string | null
  mission?: string | null
  logoUrl?: string | null
  isPublic?: boolean | null
  locationType?: "in_person" | "online" | null
  locationUrl?: string | null
  latitude?: number | null
  longitude?: number | null
  addressCity?: string | null
  addressState?: string | null
  address?: string | null
  addressStreet?: string | null
  addressPostal?: string | null
  addressCountry?: string | null
  programs?: { id: string; title?: string | null; description?: string | null }[]
  programCount: number
  canEdit: boolean
}

export type OrganizationLaunchStep = {
  id: "identity" | "story" | "location" | "program" | "publish"
  title: string
  detail: string
  complete: boolean
  optional: boolean
  href: string
}

export type OrganizationPublicationReviewData =
  | { error: string }
  | { organization: PublicMapOrganization; isPublic: boolean; updatedAt: string; revision: string; location: { label: string; detail: string } }
