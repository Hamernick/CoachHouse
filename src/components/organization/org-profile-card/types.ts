import type { OrgDocument, OrgDocuments } from "@/lib/organization/document-types"
export type { OrgDocument, OrgDocuments } from "@/lib/organization/document-types"
import type { OrgPersonWithImage } from "@/components/people/supporters-showcase"
import type { OrganizationNarrativeRevisions } from "@/lib/roadmap"

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
  donateUrl?: string | null
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
  narrativeRevisions?: OrganizationNarrativeRevisions
}

export type OrgProfileErrors = Record<string, string>

export type OrgProgram = {
  id: string
  title?: string | null
  subtitle?: string | null
  description?: string | null
  location?: string | null
  location_type?: "in_person" | "online" | null
  location_url?: string | null
  team_ids?: string[] | null
  image_url?: string | null
  status_label?: string | null
  duration_label?: string | null
  features?: string[] | null
  goal_cents?: number | null
  raised_cents?: number | null
  is_public?: boolean | null
  created_at?: string | null
  start_date?: string | null
  end_date?: string | null
  address_city?: string | null
  address_state?: string | null
  address_country?: string | null
  cta_label?: string | null
  cta_url?: string | null
  wizard_snapshot?: Record<string, unknown> | null
}

export type ProfileTab = "company" | "programs" | "people" | "supporters"

export type SlugStatus = {
  available: boolean
  suggestion?: string
  message?: string
  slug?: string
} | null

export interface OrgProfileCardProps {
  initial: OrgProfile
  people: OrgPersonWithImage[]
  programs?: OrgProgram[]
  canEdit?: boolean
  initialTab?: ProfileTab
  initialProgramId?: string | null
  initialProgramStep?: number | null
  initialFocus?: string | null
  initialEditMode?: boolean
}
