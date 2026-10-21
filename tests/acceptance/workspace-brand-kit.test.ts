import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { buildInitialOrganizationProfile } from "@/app/(dashboard)/my-organization/_lib/helpers"
import { organizationProfileSchema } from "@/components/organization/org-profile-card/validation"
import { resolveBrandKitReadiness } from "@/features/workspace-brand-kit/lib/brand-kit-readiness"
import {
  buildBrandKitReadme,
  resolveBrandManifest,
  resolveBrandPalette,
} from "@/features/workspace-brand-kit/lib/brand-kit-export"
import { createZipArchive } from "@/lib/files/simple-zip"

describe("workspace-brand-kit", () => {
  it("derives readiness from the saved profile basics", () => {
    const inProgress = resolveBrandKitReadiness({
      name: "Coach House",
      brandVoiceGuidelines: "Write with clarity and warmth.",
      logoUrl: "https://example.com/logo.png",
    })

    expect(inProgress.status).toBe("in-progress")
    expect(inProgress.completedCount).toBe(2)

    const ready = resolveBrandKitReadiness({
      name: "Coach House",
      brandVoiceGuidelines: "Write with clarity and warmth.",
      logoUrl: "https://example.com/logo.png",
      brandPrimary: "#0F172A",
      brandTypography: {
        headings: {
          family: "Space Grotesk",
          weight: "600",
          tracking: "normal",
        },
        body: {
          family: "IBM Plex Sans",
          weight: "400",
          tracking: "normal",
        },
        code: {
          family: "IBM Plex Mono",
        },
      },
    })

    expect(ready.status).toBe("ready")
  })

  it("builds a palette with the primary color first and caps supporting colors", () => {
    const palette = resolveBrandPalette({
      brandPrimary: "#0f172a",
      brandColors: [
        "#0F172A",
        "#F59E0B",
        "#14B8A6",
        "#F43F5E",
        "#8B5CF6",
        "#22C55E",
      ],
    })

    expect(palette).toEqual([
      "#0F172A",
      "#F59E0B",
      "#14B8A6",
      "#F43F5E",
      "#8B5CF6",
    ])
  })

  it("resolves a download manifest with preset metadata", () => {
    const { manifest, preset } = resolveBrandManifest({
      name: "Coach House",
      tagline: "Build a durable organization",
      brandVoiceAudience: "Nonprofit builders",
      brandVoiceTone: "Warm and practical",
      brandVoiceGuidelines: "Use direct, encouraging language.",
      brandVoiceAvoid: "Do not use insider jargon.",
      brandPrimary: "#0F172A",
      brandColors: ["#F59E0B"],
      brandThemePresetId: "skyline",
      brandAccentPresetId: "sky",
      brandTypographyPresetId: "modern-grotesk",
      brandTypography: {
        headings: {
          family: "Space Grotesk",
          weight: "600",
          tracking: "normal",
        },
        body: {
          family: "IBM Plex Sans",
          weight: "400",
          tracking: "normal",
        },
        code: {
          family: "IBM Plex Mono",
        },
      },
    })

    expect(manifest.name).toBe("Coach House")
    expect(manifest.palette).toEqual(["#0F172A", "#F59E0B"])
    expect(manifest.brandThemePresetId).toBe("skyline")
    expect(manifest.brandAccentPresetId).toBe("sky")
    expect(manifest.typographyPresetLabel).toBe("Modern Grotesk")
    expect(manifest.brandTypography?.code.family).toBe("IBM Plex Mono")
    expect(manifest.brandVoice).toEqual({
      audience: "Nonprofit builders",
      tone: "Warm and practical",
      style: null,
      personality: null,
      guidelines: "Use direct, encouraging language.",
      avoid: "Do not use insider jargon.",
    })
    expect(preset?.headingFontLabel).toBe("Space Grotesk")

    const readme = buildBrandKitReadme({ manifest, preset })
    expect(readme).toContain("Brand voice tone: Warm and practical")
    expect(readme).not.toContain("Boilerplate:")
  })

  it("creates a valid zip archive header for brand-kit exports", () => {
    const archive = createZipArchive([
      { name: "brand/brand.txt", data: "hello" },
      { name: "README.txt", data: "world" },
    ])

    expect(archive.subarray(0, 4).toString("hex")).toBe("504b0304")
    expect(archive.includes(Buffer.from("README.txt"))).toBe(true)
  })

  it("validates structured brand voice fields", () => {
    const valid = organizationProfileSchema.safeParse({
      name: "Coach House",
      brandVoiceAudience: "Community leaders",
      brandVoiceTone: "Clear and encouraging",
      brandVoiceGuidelines: "Use plain language.",
      brandVoiceAvoid: "Avoid jargon.",
    })
    expect(valid.success).toBe(true)

    const invalid = organizationProfileSchema.safeParse({
      name: "Coach House",
      brandVoiceTone: "x".repeat(241),
    })
    expect(invalid.success).toBe(false)
  })

  it("moves the existing editor into its own tab and removes the visible boilerplate control", () => {
    const root = process.cwd()
    const editMode = readFileSync(
      join(
        root,
        "src/components/organization/org-profile-card/tabs/company-tab/edit-sections/edit-mode.tsx"
      ),
      "utf8"
    )
    const profileEditor = readFileSync(
      join(
        root,
        "src/features/workspace-brand-kit/components/workspace-brand-kit-profile-editor.tsx"
      ),
      "utf8"
    )
    const brandKitSection = readFileSync(
      join(
        root,
        "src/components/organization/org-profile-card/tabs/company-tab/edit-sections/brand-kit.tsx"
      ),
      "utf8"
    )
    const sheet = readFileSync(
      join(
        root,
        "src/features/workspace-brand-kit/components/workspace-brand-kit-sheet.tsx"
      ),
      "utf8"
    )
    const sheetControls = readFileSync(
      join(
        root,
        "src/features/workspace-brand-kit/components/workspace-brand-kit-sheet-controls.tsx"
      ),
      "utf8"
    )

    const brandKitTab = readFileSync(
      join(root, "src/components/organization/org-profile-card/tabs/brand-kit-tab.tsx"),
      "utf8"
    )
    expect(editMode).not.toContain("<BrandKitSection")
    expect(brandKitTab).toContain("<BrandKitSection")
    expect(brandKitTab).toContain("<WorkspaceBrandKitProfilePreview")
    expect(profileEditor).toContain("WorkspaceBrandKitProfileStyle")
    expect(profileEditor).toContain("WorkspaceBrandKitProfileAssets")
    expect(profileEditor).toContain("WorkspaceBrandKitProfileVoice")
    expect(brandKitSection).not.toContain('layout="stacked"')
    expect(sheet).toContain('title="Brand voice"')
    expect(sheet).not.toContain("Boilerplate")
    expect(sheetControls).toContain("[&::-webkit-color-swatch]:rounded-lg")
  })

  it("hydrates the complete Brand Kit contract from the database profile JSON", () => {
    const profile = buildInitialOrganizationProfile({
      profile: {
        name: "Coach House",
        logoUrl: "https://example.com/logo.svg",
        brandMarkUrl: "https://example.com/mark.svg",
        brandPrimary: "#6C3AED",
        brandColors: ["#1E1E1E", "#F9FAFB", "#10B981"],
        brandTypography: {
          headings: {
            family: "Inter",
            weight: "600",
            tracking: "normal",
          },
          body: {
            family: "Inter",
            weight: "400",
            tracking: "normal",
          },
          code: {
            family: "Geist Mono",
          },
        },
        brandVoiceAudience: "Community leaders",
        brandVoiceTone: "Warm and direct",
        brandVoiceStyle: "Plain language",
        brandVoicePersonality: "A trusted guide",
        brandVoiceGuidelines: "Lead with the clearest next step.",
        brandVoiceAvoid: "Insider jargon",
      },
      organization: {
        ein: null,
        public_slug: "coach-house",
        is_public: false,
      },
    })

    expect(profile.logoUrl).toBe("https://example.com/logo.svg")
    expect(profile.brandMarkUrl).toBe("https://example.com/mark.svg")
    expect(profile.brandPrimary).toBe("#6C3AED")
    expect(profile.brandColors).toEqual(["#1E1E1E", "#F9FAFB", "#10B981"])
    expect(profile.brandTypography?.headings.family).toBe("Inter")
    expect(profile.brandVoiceAudience).toBe("Community leaders")
    expect(profile.brandVoiceTone).toBe("Warm and direct")
    expect(profile.brandVoiceStyle).toBe("Plain language")
    expect(profile.brandVoicePersonality).toBe("A trusted guide")
    expect(profile.brandVoiceGuidelines).toBe(
      "Lead with the clearest next step."
    )
    expect(profile.brandVoiceAvoid).toBe("Insider jargon")
  })

  it("keeps Brand Kit additive in the existing profile JSON contract", () => {
    const root = process.cwd()
    const baseSchema = readFileSync(
      join(
        root,
        "supabase/migrations/20250926140000_db_extensions_assignments_orgs.sql"
      ),
      "utf8"
    )
    const persistenceContract = readFileSync(
      join(root, "src/lib/organization/profile-persistence-validation.ts"),
      "utf8"
    )
    const organizationAction = readFileSync(
      join(root, "src/actions/organization.ts"),
      "utf8"
    )

    expect(baseSchema).toContain("profile jsonb not null default '{}'::jsonb")
    expect(persistenceContract).toContain(
      "organizationProfilePersistencePatchSchema"
    )
    expect(persistenceContract).toContain("brandTypography")
    expect(persistenceContract).toContain("brandVoiceAudience")
    expect(persistenceContract).toContain("brandVoiceGuidelines")
    expect(organizationAction).toContain(
      "validateOrganizationProfilePersistencePatch(payload)"
    )
    expect(organizationAction).toContain(
      "Do not delete unknown keys; preserve previously stored profile fields"
    )
  })
})
