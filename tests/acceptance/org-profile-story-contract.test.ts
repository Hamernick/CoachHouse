import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { buildInitialOrganizationProfile } from "@/app/(dashboard)/my-organization/_lib/helpers"
import { resolveOrganizationProfileComplete as resolvePageProfileComplete } from "@/app/(dashboard)/my-organization/_lib/my-organization-page-content-helpers"
import { resolveOrganizationProfileComplete as resolveWorkspaceSeedProfileComplete } from "@/app/(dashboard)/my-organization/_lib/my-organization-workspace-seed-helpers"
import { OrgProfilePublicAboutSection } from "@/components/organization/org-profile-card/public-card-sections"
import { StorySection } from "@/components/organization/org-profile-card/tabs/company-tab/edit-sections/story"
import { StoryPreview } from "@/components/organization/org-profile-card/tabs/company-tab/display-sections"
import {
  organizationProfileSchema,
  ORG_PROFILE_ROADMAP_TEXT_MAX_LENGTH,
} from "@/components/organization/org-profile-card/validation"
import { cleanupOrgProfileHtml } from "@/lib/organization/profile-cleanup"

describe("organization profile story contract", () => {
  it.each([
    "originStory",
    "need",
    "mission",
    "vision",
    "values",
    "theoryOfChange",
  ])("preserves safe rich formatting in the %s About us panel", (field) => {
    const markup = renderToStaticMarkup(
      createElement(StoryPreview, {
        company: {
          [field]:
            '<h2>Our work</h2><p style="text-align: center"><strong>Local</strong> <em>support</em></p><ul><li>First priority</li></ul><script>unsafe()</script>',
        },
        addressLines: [],
        hasAnyBrandLink: false,
      })
    )
    expect(markup).toContain("<h2>Our work</h2>")
    expect(markup).toContain(
      '<p style="text-align:center"><strong>Local</strong> <em>support</em></p>'
    )
    expect(markup).toContain("<ul><li>First priority</li></ul>")
    expect(markup).not.toContain("unsafe()")
    expect(markup).not.toContain("Read more")
  })

  it("exposes one About us panel and keeps other sections out of keyboard navigation", () => {
    const markup = renderToStaticMarkup(
      createElement(StoryPreview, {
        company: {
          originStory: "Our origin",
          mission: "Our mission",
          vision: "Our vision",
        },
        addressLines: [],
        hasAnyBrandLink: false,
      })
    )
    const panels = markup.match(/<div[^>]*role="tabpanel"[^>]*>/g) ?? []
    expect(panels).toHaveLength(3)
    expect(panels.filter((panel) => !panel.includes('hidden=""'))).toHaveLength(
      1
    )
    expect(panels.filter((panel) => panel.includes('inert=""'))).toHaveLength(2)
  })

  it("hydrates the added story fields from both camelCase and snake_case profile keys", () => {
    const legacyProfile = buildInitialOrganizationProfile({
      profile: {
        name: "Atlas Org",
        origin_story: "Legacy origin story",
        theory_of_change: "Legacy theory of change",
      },
      organization: {
        ein: null,
        public_slug: "atlas-org",
        is_public: true,
      },
    })

    const currentProfile = buildInitialOrganizationProfile({
      profile: {
        name: "Beacon Org",
        originStory: "Current origin story",
        theoryOfChange: "Current theory of change",
      },
      organization: {
        ein: null,
        public_slug: "beacon-org",
        is_public: true,
      },
    })

    expect(legacyProfile.originStory).toBe("<p>Legacy origin story</p>")
    expect(legacyProfile.theoryOfChange).toBe("<p>Legacy theory of change</p>")
    expect(currentProfile.originStory).toBe("<p>Current origin story</p>")
    expect(currentProfile.theoryOfChange).toBe(
      "<p>Current theory of change</p>"
    )
  })

  it("sanitizes and renders the added story fields in the internal and public profile views", () => {
    const cleaned = cleanupOrgProfileHtml({
      originStory: "<p>Started in a church basement.</p>",
      theoryOfChange: "<strong>Pair coaching with shared tools.</strong>",
    })

    expect(cleaned.nextProfile.originStory).toBe(
      "Started in a church basement."
    )
    expect(cleaned.nextProfile.theoryOfChange).toBe(
      "Pair coaching with shared tools."
    )

    const company = {
      name: "Atlas Org",
      description: "",
      tagline: "",
      ein: "",
      formationStatus: "approved" as const,
      rep: "",
      email: "",
      phone: "",
      address: "",
      addressStreet: "",
      addressCity: "",
      addressState: "",
      addressPostal: "",
      addressCountry: "",
      locationType: "in_person" as const,
      locationUrl: "",
      logoUrl: "",
      brandMarkUrl: "",
      headerUrl: "",
      publicUrl: "",
      twitter: "",
      facebook: "",
      linkedin: "",
      instagram: "",
      youtube: "",
      tiktok: "",
      newsletter: "",
      github: "",
      vision: "Every neighborhood can access trusted support.",
      mission: "Equip local operators with tools and coaching.",
      need: "Families face fragmented systems.",
      values: "Care, clarity, rigor",
      originStory: "Started in a church basement.",
      theoryOfChange: "Pair coaching with shared tools.",
      programs: "",
      reports: "",
      boilerplate: "",
      brandPrimary: "",
      brandColors: [],
      brandThemePresetId: "",
      brandAccentPresetId: "",
      brandTypographyPresetId: "",
      brandTypography: null,
      publicSlug: "atlas-org",
      isPublic: true,
    }

    const previewMarkup = renderToStaticMarkup(
      createElement(StoryPreview, {
        company,
        addressLines: [],
        hasAnyBrandLink: false,
      })
    )
    const publicMarkup = renderToStaticMarkup(
      createElement(OrgProfilePublicAboutSection, {
        description: "",
        originStory: company.originStory ?? "",
        need: company.need ?? "",
        mission: company.mission ?? "",
        vision: company.vision ?? "",
        values: company.values ?? "",
        theoryOfChange: company.theoryOfChange ?? "",
      })
    )

    expect(previewMarkup).toContain("Origin story")
    expect(previewMarkup).toContain("Theory of change")
    expect(previewMarkup).toContain("Started in a church basement.")
    expect(publicMarkup).toContain("Origin story")
    expect(previewMarkup).toContain(">Need</")
    expect(publicMarkup).toContain(">Need</")
    expect(previewMarkup).not.toContain("Need statement")
    expect(publicMarkup).not.toContain("Need statement")
    expect(publicMarkup).toContain("Theory of change")
    expect(publicMarkup).toContain("Pair coaching with shared tools.")
  })

  it("counts the added story fields toward organization profile completeness", () => {
    const profile = {
      name: "Atlas Org",
      tagline: "",
      description: "",
      formationStatus: "",
      originStory: "Started after repeated service gaps.",
      theoryOfChange: "Train operators and connect families earlier.",
      mission: "",
      vision: "",
      need: "",
    }

    expect(resolvePageProfileComplete(profile)).toBe(true)
    expect(resolveWorkspaceSeedProfileComplete(profile)).toBe(true)
  })

  it("shows rich story fields and inline validation errors in edit mode", () => {
    const company = {
      name: "Atlas Org",
      description: "",
      tagline: "",
      ein: "",
      formationStatus: "approved" as const,
      rep: "",
      email: "",
      phone: "",
      address: "",
      addressStreet: "",
      addressCity: "",
      addressState: "",
      addressPostal: "",
      addressCountry: "",
      locationType: "in_person" as const,
      locationUrl: "",
      logoUrl: "",
      brandMarkUrl: "",
      headerUrl: "",
      publicUrl: "",
      twitter: "",
      facebook: "",
      linkedin: "",
      instagram: "",
      youtube: "",
      tiktok: "",
      newsletter: "",
      github: "",
      vision: "",
      mission: "",
      need: "",
      values: "",
      originStory: "Started with repeated service gaps.",
      theoryOfChange: "",
      programs: "",
      reports: "",
      boilerplate: "",
      brandPrimary: "",
      brandColors: [],
      brandThemePresetId: "",
      brandAccentPresetId: "",
      brandTypographyPresetId: "",
      brandTypography: null,
      publicSlug: "atlas-org",
      isPublic: true,
    }

    const markup = renderToStaticMarkup(
      createElement(StorySection, {
        company,
        errors: {
          originStory: `Origin story must be ${ORG_PROFILE_ROADMAP_TEXT_MAX_LENGTH.toLocaleString()} characters or less.`,
        },
        onInputChange: () => undefined,
        onUpdate: () => undefined,
        onDirty: () => undefined,
        onAutoSave: async () => undefined,
        setSlugStatus: () => undefined,
        slugStatus: null,
      })
    )

    expect(markup).toContain("Origin story")
    expect(markup).toContain("Origin story must be 20,000 characters or less.")
  })

  it("allows longer roadmap story fields while keeping a clear maximum", () => {
    const base = {
      name: "Atlas Org",
      tagline: "",
      description: "",
      originStory: "A".repeat(6000),
      vision: "",
      mission: "",
      need: "",
      values: "",
      theoryOfChange: "",
    }

    expect(organizationProfileSchema.safeParse(base).success).toBe(true)

    const result = organizationProfileSchema.safeParse({
      ...base,
      originStory: "A".repeat(ORG_PROFILE_ROADMAP_TEXT_MAX_LENGTH + 1),
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.originStory?.[0]).toBe(
        "Origin story must be 20,000 characters or less."
      )
    }
  })
})
