import { z } from "zod"

export const BRAND_ASSET_IDS = [
  "primary-logo", "brand-mark", "application-image", "application-vertical-image",
  "illustration-1", "illustration-2", "illustration-3", "illustration-4", "illustration-5", "illustration-6",
] as const

const text = z.string().max(5000)
export const organizationBrandIdentitySchema = z.object({
  version: z.literal(1),
  revision: z.string().uuid().nullable(),
  draft: z.object({
    version: z.literal(1), organizationName: z.string().max(120), tagline: z.string().max(160),
    introduction: text, purpose: text, audience: z.string().max(240),
    actionables: z.tuple([z.string().max(120), z.string().max(120), z.string().max(120)]),
    logoGuidance: text,
    colors: z.array(z.object({
      id: z.enum(["canvas", "brand", "utility", "ink"]),
      role: z.enum(["Background", "Primary", "Secondary", "Text"]),
      name: z.string().max(120), value: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      proportion: z.number().min(0).max(100),
    }).strict()).length(4).refine(colors => colors.every((color, index) => color.id === ["canvas", "brand", "utility", "ink"][index] && color.role === ["Background", "Primary", "Secondary", "Text"][index]), "Keep the four palette roles in order."),
    headingFont: z.string().min(1).max(120), bodyFont: z.string().min(1).max(120),
    baseSize: z.number().min(14).max(20), typeRatio: z.number().min(1.125).max(1.5),
    campaignHeadline: z.string().max(300), campaignBody: text, updatedAt: z.string().max(40),
  }).strict(),
  assets: z.partialRecord(z.enum(BRAND_ASSET_IDS), z.object({
    fileId: z.string().uuid(), name: z.string().min(1).max(1024),
    type: z.enum(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]),
    size: z.number().int().positive().max(12 * 1024 * 1024), updatedAt: z.string().max(40),
  }).strict().nullable()),
}).strict()

export type OrganizationBrandIdentity = z.infer<typeof organizationBrandIdentitySchema>
export type OrganizationBrandAsset = NonNullable<OrganizationBrandIdentity["assets"][typeof BRAND_ASSET_IDS[number]]>

export function readOrganizationBrandIdentity(value: unknown): OrganizationBrandIdentity | undefined {
  const parsed = organizationBrandIdentitySchema.safeParse(value)
  return parsed.success ? parsed.data : undefined
}
