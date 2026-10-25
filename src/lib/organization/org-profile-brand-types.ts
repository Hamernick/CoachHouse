import type { OrganizationBrandIdentity } from "@/lib/organization/brand-identity-schema"
export type FormationStatus = "pre_501c3" | "in_progress" | "approved"

export type BrandTypographyTracking =
  | "tighter"
  | "tight"
  | "normal"
  | "wide"
  | "wider"

export type BrandTypographySlot = {
  family: string
  weight: string
  tracking: BrandTypographyTracking
}

export type BrandTypographyConfig = {
  headings: BrandTypographySlot
  body: BrandTypographySlot
  code: {
    family: string
  }
}

export type OrgProfile = {
  brandIdentity?: OrganizationBrandIdentity
  expectedOrganizationId?: string
  name?: string | null
  description?: string | null
  tagline?: string | null
  ein?: string | null
  formationStatus?: FormationStatus | null
  rep?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  addressStreet?: string | null
  addressCity?: string | null
  addressState?: string | null
  addressPostal?: string | null
  addressCountry?: string | null
  locationType?: "in_person" | "online" | null
  locationUrl?: string | null
  logoUrl?: string | null
  brandMarkUrl?: string | null
  headerUrl?: string | null
  publicUrl?: string | null
  twitter?: string | null
  facebook?: string | null
  linkedin?: string | null
  instagram?: string | null
  youtube?: string | null
  tiktok?: string | null
  newsletter?: string | null
  github?: string | null
  vision?: string | null
  mission?: string | null
  need?: string | null
  values?: string | null
  originStory?: string | null
  theoryOfChange?: string | null
  programs?: string | null
  reports?: string | null
  boilerplate?: string | null
  brandVoiceAudience?: string | null
  brandVoiceTone?: string | null
  brandVoiceStyle?: string | null
  brandVoicePersonality?: string | null
  brandVoiceGuidelines?: string | null
  brandVoiceAvoid?: string | null
  brandPrimary?: string | null
  brandColors?: string[] | null
  brandThemePresetId?: string | null
  brandAccentPresetId?: string | null
  brandTypographyPresetId?: string | null
  brandTypography?: BrandTypographyConfig | null
  publicSlug?: string | null
  isPublic?: boolean | null
}
