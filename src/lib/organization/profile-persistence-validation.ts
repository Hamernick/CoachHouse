import { organizationBrandIdentitySchema } from "./brand-identity-schema"
import { ORGANIZATION_CORE_DOCUMENT_SECTION_IDS } from "@/lib/roadmap/organization-core-documents"
import { z } from "zod"

export const ORG_PROFILE_ROADMAP_TEXT_MAX_LENGTH = 20_000
export const ORG_PROFILE_BRAND_VOICE_ATTRIBUTE_MAX_LENGTH = 240
export const ORG_PROFILE_BRAND_VOICE_LONG_FORM_MAX_LENGTH = 5_000
export const ORG_PROFILE_BRAND_COLOR_LIMIT = 12

export const organizationProfileHexColorSchema = z
  .string()
  .regex(/^#?[0-9a-fA-F]{6}$/i, "Must be a hex color like #0055FF")
  .transform((value) => (value.startsWith("#") ? value : `#${value}`))

export const organizationProfileHexColorInputSchema =
  organizationProfileHexColorSchema.optional().or(z.literal(""))

export const organizationProfileBrandTypographyTrackingSchema = z.enum([
  "tighter",
  "tight",
  "normal",
  "wide",
  "wider",
])

export const organizationProfileBrandTypographySlotSchema = z.object({
  family: z.string().min(1).max(120),
  weight: z.string().min(1).max(8),
  tracking: organizationProfileBrandTypographyTrackingSchema,
})

export const organizationProfileBrandTypographySchema = z.object({
  headings: organizationProfileBrandTypographySlotSchema,
  body: organizationProfileBrandTypographySlotSchema,
  code: z.object({
    family: z.string().min(1).max(120),
  }),
})

export const organizationProfileBrandVoiceAttributeSchema = z
  .string()
  .max(
    ORG_PROFILE_BRAND_VOICE_ATTRIBUTE_MAX_LENGTH,
    `Brand voice fields must be ${ORG_PROFILE_BRAND_VOICE_ATTRIBUTE_MAX_LENGTH} characters or less.`
  )

export const organizationProfileBrandVoiceLongFormSchema = z
  .string()
  .max(
    ORG_PROFILE_BRAND_VOICE_LONG_FORM_MAX_LENGTH,
    `Brand voice guidance must be ${ORG_PROFILE_BRAND_VOICE_LONG_FORM_MAX_LENGTH.toLocaleString()} characters or less.`
  )

export function organizationProfileNarrativeSchema(label: string) {
  return z
    .string()
    .max(
      ORG_PROFILE_ROADMAP_TEXT_MAX_LENGTH,
      `${label} must be ${ORG_PROFILE_ROADMAP_TEXT_MAX_LENGTH.toLocaleString()} characters or less.`
    )
}

const narrativeRevisionSchema = z.string().nullable().optional()

export const organizationProfileNameSchema = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(120)

export const organizationProfilePersistencePatchSchema = z
  .object({
    name: organizationProfileNameSchema.optional(),
    expectedOrganizationId: z.string().uuid().optional(),
    brandIdentity: organizationBrandIdentitySchema.optional(),
    mission: organizationProfileNarrativeSchema("Mission")
      .nullable()
      .optional(),
    vision: organizationProfileNarrativeSchema("Vision").nullable().optional(),
    values: organizationProfileNarrativeSchema("Values").nullable().optional(),
    coreDocumentPublication: z.object(Object.fromEntries(
      Object.keys(ORGANIZATION_CORE_DOCUMENT_SECTION_IDS).map((key) => [key,
        z.object({
          status: z.enum(["not_started", "in_progress", "complete"]).optional(),
          lastUpdated: z.string().nullable(),
        }).strict().optional(),
      ])
    )).strict().optional(),
    narrativeRevisions: z
      .object({
        mission: narrativeRevisionSchema,
        vision: narrativeRevisionSchema,
        values: narrativeRevisionSchema,
      })
      .optional(),
    brandVoiceAudience: organizationProfileBrandVoiceAttributeSchema
      .nullable()
      .optional(),
    brandVoiceTone: organizationProfileBrandVoiceAttributeSchema
      .nullable()
      .optional(),
    brandVoiceStyle: organizationProfileBrandVoiceAttributeSchema
      .nullable()
      .optional(),
    brandVoicePersonality: organizationProfileBrandVoiceAttributeSchema
      .nullable()
      .optional(),
    brandVoiceGuidelines: organizationProfileBrandVoiceLongFormSchema
      .nullable()
      .optional(),
    brandVoiceAvoid: organizationProfileBrandVoiceLongFormSchema
      .nullable()
      .optional(),
    brandPrimary: organizationProfileHexColorInputSchema.nullable(),
    brandColors: z
      .array(organizationProfileHexColorInputSchema)
      .max(
        ORG_PROFILE_BRAND_COLOR_LIMIT,
        `Brand colors are limited to ${ORG_PROFILE_BRAND_COLOR_LIMIT}.`
      )
      .nullable()
      .optional(),
    brandThemePresetId: z.string().max(60).nullable().optional(),
    brandAccentPresetId: z.string().max(60).nullable().optional(),
    brandTypographyPresetId: z.string().max(60).nullable().optional(),
    brandTypography: organizationProfileBrandTypographySchema
      .nullable()
      .optional(),
  })
  .passthrough()

export function validateOrganizationProfilePersistencePatch(
  payload: unknown
): { success: true } | { success: false; error: string; field: string | null } {
  const result = organizationProfilePersistencePatchSchema.safeParse(payload)
  if (result.success) return { success: true }

  const issue = result.error.issues[0]
  return {
    success: false,
    error: issue?.message ?? "Organization profile data is invalid.",
    field: typeof issue?.path[0] === "string" ? issue.path[0] : null,
  }
}
