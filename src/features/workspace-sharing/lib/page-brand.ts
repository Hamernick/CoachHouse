import { z } from "zod"

export const pageBrandColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/)
export const PAGE_LOGO_IMAGE_KEY = "brand-logo"
export const pageBrandLogoSchema = z.strictObject({
  assetId: z.uuid(), width: z.int().min(1).max(2048), height: z.int().min(1).max(2048),
})

/** Canonical library identity only. Legacy URLs are never fetched or copied. */
export function pageLogoFileId(profile: unknown): string | undefined {
  const parsed = z.object({ brandIdentity: z.object({ assets: z.object({
    "primary-logo": z.object({ fileId: z.uuid() }).nullable().optional(),
  }).optional() }).nullable().optional() }).parse(profile)
  return parsed.brandIdentity?.assets?.["primary-logo"]?.fileId
}

/** Only the existing saved profile color enters review, never arbitrary CSS,
 * private kit contents, asset URLs or remote font requests. */
export function projectPageBrandColor(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const color = value.trim()
  if (!/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color)) return undefined
  return (color.length === 4 ? `#${[...color.slice(1)].map(part => part + part).join("")}` : color).toUpperCase()
}

/** Choose black or white by relative luminance: even the crossover exceeds
 * 4.5:1. Theme changes cannot turn the committed initials into low-contrast text. */
export function pageBrandStyle(value?: string) {
  const color = projectPageBrandColor(value)
  if (!color) return undefined
  const channels = [1, 3, 5].map(index => {
    const channel = Number.parseInt(color.slice(index, index + 2), 16) / 255
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
  return { backgroundColor: color, color: (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05) ? "#000000" : "#FFFFFF" }
}
