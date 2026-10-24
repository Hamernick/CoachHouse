import type { BrandIdentityDraft } from "@/features/nonprofit-documentation"
import {
  DEFAULT_BRAND_IDENTITY_DRAFT, sanitizeBrandDraft, normalizeHex,
} from "@/features/nonprofit-documentation"
import type { OrgProfile } from "@/lib/organization/org-profile-brand-types"
import type { OrganizationBrandIdentity } from "@/lib/organization/brand-identity-schema"
import { resolveBrandTypographyConfig } from "./brand-kit-presets"

export function resolveWorkspaceBrandIdentity(profile: OrgProfile): OrganizationBrandIdentity {
  if (profile.brandIdentity) return {
    ...profile.brandIdentity,
    draft: { ...profile.brandIdentity.draft, organizationName: profile.name ?? "", tagline: profile.tagline ?? "" },
  }
  const typography = resolveBrandTypographyConfig(profile)
  const defaults = DEFAULT_BRAND_IDENTITY_DRAFT
  const primary = profile.brandPrimary?.trim()
  return {
    version: 1, revision: null, assets: {},
    draft: {
      ...sanitizeBrandDraft({
        ...defaults, organizationName: profile.name ?? "", tagline: profile.tagline ?? "",
        introduction: profile.description ?? "", purpose: "", audience: profile.brandVoiceAudience ?? "",
        campaignHeadline: "", campaignBody: "",
        colors: defaults.colors.map(color => ({ ...color,
          value: color.id === "brand" && primary ? normalizeHex(primary)
            : color.id === "utility" && profile.brandColors?.[0] ? normalizeHex(profile.brandColors[0])
            : color.value,
        })),
      }),
      headingFont: typography.headings.family || defaults.headingFont,
      bodyFont: typography.body.family || defaults.bodyFont,
    },
  }
}

export function updateWorkspaceBrandIdentity(profile: OrgProfile, updates: Partial<BrandIdentityDraft>): Partial<OrgProfile> {
  const current = resolveWorkspaceBrandIdentity(profile)
  const draft = { ...current.draft, ...updates, updatedAt: new Date().toISOString() }
  const next: Partial<OrgProfile> = { brandIdentity: { ...current, draft } }
  if (updates.organizationName !== undefined) next.name = updates.organizationName
  if (updates.tagline !== undefined) next.tagline = updates.tagline
  if (updates.audience !== undefined) next.brandVoiceAudience = updates.audience
  if (updates.colors) {
    next.brandPrimary = draft.colors.find(color => color.id === "brand")?.value
    // Retain the user's existing extra colors rather than replacing their palette.
    next.brandColors = [...new Set([
      ...draft.colors.filter(color => color.id !== "brand").map(color => color.value),
      ...(profile.brandColors ?? []),
    ])].slice(0, 12)
  }
  if (updates.headingFont !== undefined || updates.bodyFont !== undefined) {
    const typography = resolveBrandTypographyConfig(profile)
    next.brandTypography = { ...typography,
      headings: { ...typography.headings, family: draft.headingFont },
      body: { ...typography.body, family: draft.bodyFont },
    }
  }
  return next
}
