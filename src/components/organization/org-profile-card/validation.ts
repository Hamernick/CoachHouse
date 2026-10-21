import { z } from "zod"
import { getApprovedFormationEinError } from "@/lib/organization/formation-status"

import {
  ORG_PROFILE_ROADMAP_TEXT_MAX_LENGTH,
  organizationProfileBrandTypographySchema,
  organizationProfileBrandVoiceAttributeSchema,
  organizationProfileBrandVoiceLongFormSchema,
  organizationProfileHexColorInputSchema,
  organizationProfileNarrativeSchema,
  organizationProfileNameSchema,
} from "@/lib/organization/profile-persistence-validation"
import { isValidExternalUrl } from "@/lib/organization/urls"

export const hexColor = organizationProfileHexColorInputSchema
export { ORG_PROFILE_ROADMAP_TEXT_MAX_LENGTH }

const urlInput = z
  .string()
  .trim()
  .refine((value) => value.length === 0 || isValidExternalUrl(value), {
    message: "Enter a valid URL or domain",
  })
  .optional()

const roadmapText = (label: string) =>
  organizationProfileNarrativeSchema(label).optional().or(z.literal(""))

const brandVoiceAttribute = organizationProfileBrandVoiceAttributeSchema
  .optional()
  .or(z.literal(""))
const brandVoiceLongForm = organizationProfileBrandVoiceLongFormSchema
  .optional()
  .or(z.literal(""))

export const organizationProfileSchema = z.object({
  name: organizationProfileNameSchema,
  tagline: z.string().max(160).optional().or(z.literal("")),
  description: z.string().max(5000).optional().or(z.literal("")),
  ein: z.string().trim().optional(),
  formationStatus: z.enum(["pre_501c3", "in_progress", "approved"]).optional(),
  rep: z.string().max(120).optional().or(z.literal("")),
  email: z.string().email("Must be a valid email").optional().or(z.literal("")),
  phone: z.string().max(60).optional().or(z.literal("")),
  address: z.string().max(500).optional().or(z.literal("")),
  addressStreet: z.string().max(400).optional().or(z.literal("")),
  addressCity: z.string().max(200).optional().or(z.literal("")),
  addressState: z.string().max(200).optional().or(z.literal("")),
  addressPostal: z.string().max(40).optional().or(z.literal("")),
  addressCountry: z.string().max(120).optional().or(z.literal("")),
  locationType: z.enum(["in_person", "online"]).optional(),
  locationUrl: urlInput.or(z.literal("")),
  logoUrl: urlInput.or(z.literal("")),
  brandMarkUrl: urlInput.or(z.literal("")),
  headerUrl: urlInput.or(z.literal("")),
  publicUrl: urlInput.or(z.literal("")),
  donateUrl: urlInput.or(z.literal("")),
  twitter: z.string().max(200).optional().or(z.literal("")),
  facebook: z.string().max(200).optional().or(z.literal("")),
  linkedin: z.string().max(200).optional().or(z.literal("")),
  instagram: z.string().max(200).optional().or(z.literal("")),
  youtube: z.string().max(200).optional().or(z.literal("")),
  tiktok: z.string().max(200).optional().or(z.literal("")),
  newsletter: z.string().max(200).optional().or(z.literal("")),
  github: z.string().max(200).optional().or(z.literal("")),
  vision: roadmapText("Vision"),
  mission: roadmapText("Mission"),
  need: roadmapText("Need"),
  values: roadmapText("Values"),
  originStory: roadmapText("Origin story"),
  theoryOfChange: roadmapText("Theory of change"),
  programs: z.string().max(5000).optional().or(z.literal("")),
  reports: z.string().max(5000).optional().or(z.literal("")),
  boilerplate: z.string().max(5000).optional().or(z.literal("")),
  brandVoiceAudience: brandVoiceAttribute,
  brandVoiceTone: brandVoiceAttribute,
  brandVoiceStyle: brandVoiceAttribute,
  brandVoicePersonality: brandVoiceAttribute,
  brandVoiceGuidelines: brandVoiceLongForm,
  brandVoiceAvoid: brandVoiceLongForm,
  brandPrimary: hexColor,
  brandColors: z.array(hexColor).max(12).optional(),
  brandThemePresetId: z.string().max(60).optional().or(z.literal("")),
  brandAccentPresetId: z.string().max(60).optional().or(z.literal("")),
  brandTypographyPresetId: z.string().max(60).optional().or(z.literal("")),
  brandTypography: organizationProfileBrandTypographySchema.nullish(),
  publicSlug: z
    .string()
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/i,
      "Use letters, numbers, and dashes only"
    )
    .max(60)
    .optional()
    .or(z.literal("")),
  isPublic: z.boolean().optional(),
}).superRefine((profile, context) => {
  const error = getApprovedFormationEinError(profile.formationStatus, profile.ein)
  if (error) context.addIssue({ code: "custom", path: ["ein"], message: error })
})
