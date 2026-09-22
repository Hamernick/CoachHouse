import { createHash } from "node:crypto"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  BRAND_FONT_GROUPS,
  BRAND_FONT_OPTIONS,
  BRAND_IDENTITY_PATH,
  COMPLIANCE_ARTICLE,
  DEFAULT_BRAND_IDENTITY_DRAFT,
  DEFAULT_CAMPAIGN_PLAN,
  DEFAULT_CRM_PLAN,
  DEFAULT_COMPLIANCE_RHYTHM,
  DEFAULT_FUNDRAISING_PLAN,
  DEFAULT_FINANCE_PLAN,
  DEFAULT_HR_PLAN,
  DEFAULT_LEGAL_PLAN,
  DEFAULT_LOGIC_MODEL_DRAFT,
  DEFAULT_MARKETING_PLAN,
  DEFAULT_MEASUREMENT_PLAN,
  DEFAULT_NETWORKING_PLAN,
  DEFAULT_PARTNERSHIP_BRIEF,
  DEFAULT_SUSTAINABILITY_PLAN,
  DEFAULT_SOCIAL_MEDIA_PLAN,
  DOCUMENTATION_NAVIGATION,
  DOCUMENTATION_PATH,
  KEY_CONCEPTS_GUIDE,
  MISSION_ARTICLE,
  FUNDRAISING_ARTICLE,
  FINANCE_ARTICLE,
  FRAMEWORKS_ARTICLE,
  HR_ARTICLE,
  LEGAL_ARTICLE,
  CAMPAIGNS_ARTICLE,
  CRM_ARTICLE,
  MARKETING_ARTICLE,
  MARKETPLACE_RESOURCES,
  MEASURING_IMPACT_ARTICLE,
  NETWORKING_ARTICLE,
  PARTNERSHIPS_ARTICLE,
  SUSTAINABILITY_ARTICLE,
  SOCIAL_MEDIA_ARTICLE,
  QUICKSTART_GUIDE,
  brandColorLabel,
  buildComplianceCsv,
  buildComplianceTasks,
  buildFundraisingActions,
  buildFundraisingCsv,
  buildFinanceActions,
  buildFinanceCsv,
  buildFinanceReviewPrompt,
  buildHrActions,
  buildHrCsv,
  buildHrReviewPrompt,
  buildLegalActions,
  buildLegalCsv,
  buildLegalReviewPrompt,
  buildLogicModelActions,
  buildLogicModelCsv,
  buildLogicModelReviewPrompt,
  buildMarketingActions,
  buildMarketingAiPrompt,
  buildMarketingCsv,
  buildMarketplaceShortlistCsv,
  buildMeasurementPlanActions,
  buildMeasurementPlanCsv,
  buildMeasurementReviewPrompt,
  buildNetworkingActions,
  buildNetworkingCsv,
  buildNetworkingReviewPrompt,
  buildPartnershipBriefActions,
  buildPartnershipBriefCsv,
  buildPartnershipReviewPrompt,
  buildSustainabilityActions,
  buildSustainabilityCsv,
  buildSustainabilityReviewPrompt,
  buildSocialMediaActions,
  buildSocialMediaCsv,
  buildSocialMediaReviewPrompt,
  buildTrackedSocialUrl,
  buildBrandTokens,
  buildCampaignActions,
  buildCampaignCsv,
  buildCampaignReviewPrompt,
  buildCrmActions,
  buildCrmCsv,
  buildCrmReviewPrompt,
  brandFontStack,
  commonFederalFilingPath,
  contrastRating,
  contrastRatio,
  nominalAnnualReturnDueDate,
  normalizeHex,
  normalizeProportions,
  sanitizeComplianceRhythm,
  sanitizeFundraisingPlan,
  sanitizeFinancePlan,
  sanitizeHrPlan,
  sanitizeLegalPlan,
  sanitizeLogicModelDraft,
  sanitizeMarketingPlan,
  sanitizeMarketplaceFilters,
  sanitizeMarketplaceShortlist,
  sanitizeMeasurementPlan,
  sanitizeNetworkingPlan,
  sanitizePartnershipBrief,
  sanitizeSustainabilityPlan,
  sanitizeSocialMediaPlan,
  sanitizeBrandDraft,
  sanitizeCampaignPlan,
  sanitizeCrmPlan,
  typeScale,
  summarizeFundraisingPlan,
  summarizeFinancePlan,
  summarizeHrPlan,
  summarizeLegalPlan,
  summarizeCampaignPlan,
  summarizeCrmPlan,
  summarizeLogicModel,
  summarizeMarketingPlan,
  summarizeMeasurementPlan,
  summarizeNetworkingPlan,
  summarizePartnershipBrief,
  summarizeSustainabilityPlan,
  summarizeSocialMediaPlan,
  recommendedFramework,
  filterMarketplaceResources,
  projectMarketplaceCommunityProfiles,
} from "@/features/nonprofit-documentation"
import { createBrowserZip } from "@/features/nonprofit-documentation/lib/brand-identity-export"
import { DOCUMENTATION_SEARCH_DOCUMENTS } from "@/features/nonprofit-documentation/lib/search-documents"
import {
  documentationArtwork,
  getDocumentationArtwork,
} from "@/features/nonprofit-documentation/components/documentation-artwork"

const ROOT = process.cwd()

function readSource(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8")
}

describe("nonprofit documentation feature", () => {
  it("gives every article a distinct authored image without a shared fallback", () => {
    const pages = DOCUMENTATION_SEARCH_DOCUMENTS.filter(
      ({ href }) =>
        ![DOCUMENTATION_PATH, `${DOCUMENTATION_PATH}/marketplace`].includes(
          href
        )
    ).map(({ href }) => href.slice(DOCUMENTATION_PATH.length + 1))
    expect(Object.keys(documentationArtwork).sort()).toEqual([...pages].sort())
    expect(new Set(pages.map(getDocumentationArtwork)).size).toBe(pages.length)
    expect(() => getDocumentationArtwork("unregistered-page")).toThrow(
      "Missing Documentation artwork"
    )

    const directory = join(
      ROOT,
      "src/features/nonprofit-documentation/assets/heroes"
    )
    const files = readdirSync(directory).filter((file) =>
      file.endsWith(".webp")
    )
    const hashes = files.map((file) =>
      createHash("sha256")
        .update(readFileSync(join(directory, file)))
        .digest("hex")
    )
    expect(files).toHaveLength(pages.length)
    expect(new Set(hashes).size).toBe(pages.length)
  })

  it("publishes one canonical navigation registry without dead links", () => {
    expect(DOCUMENTATION_PATH).toBe("/documentation")
    expect(DOCUMENTATION_NAVIGATION.map((section) => section.title)).toEqual([
      "Get started",
      "Best practices",
      "Tools",
      "Resources",
    ])

    const items = DOCUMENTATION_NAVIGATION.flatMap((section) => section.items)
    expect(items.map((item) => item.title)).toEqual(
      expect.arrayContaining([
        "Quickstart",
        "Mission",
        "Compliance",
        "Fundraising",
        "Measuring impact",
        "Brand identity",
        "Finance",
        "Legal",
        "Map",
        "Marketplace",
      ])
    )
    expect(items.find((item) => item.title === "Map")?.href).toBe("/")
    expect(items.find((item) => item.title === "Quickstart")?.href).toBe(
      "/documentation/quickstart"
    )
    expect(items.find((item) => item.title === "Key concepts")?.href).toBe(
      "/documentation/key-concepts"
    )
    const brandIdentity = items.find((item) => item.title === "Brand identity")
    expect(brandIdentity).toMatchObject({
      status: "live",
      href: "/documentation/tools/brand-identity",
    })
    expect(items.find((item) => item.title === "Compliance")).toMatchObject({
      status: "live",
      href: "/documentation/best-practices/compliance",
    })
    expect(items.find((item) => item.title === "Fundraising")).toMatchObject({
      status: "live",
      href: "/documentation/best-practices/fundraising",
    })
    expect(items.find((item) => item.title === "Marketing")).toMatchObject({
      status: "live",
      href: "/documentation/best-practices/marketing",
    })
    expect(items.find((item) => item.title === "Frameworks")).toMatchObject({
      status: "live",
      href: "/documentation/best-practices/frameworks",
    })
    expect(
      items.find((item) => item.title === "Measuring impact")
    ).toMatchObject({
      status: "live",
      href: "/documentation/best-practices/measuring-impact",
    })
    expect(items.find((item) => item.title === "Sustainability")).toMatchObject(
      {
        status: "live",
        href: "/documentation/best-practices/sustainability",
      }
    )
    expect(items.find((item) => item.title === "Partnerships")).toMatchObject({
      status: "live",
      href: "/documentation/best-practices/partnerships",
    })
    expect(items.find((item) => item.title === "Social media")).toMatchObject({
      status: "live",
      href: "/documentation/tools/social-media",
    })
    expect(items.find((item) => item.title === "Networking")).toMatchObject({
      status: "live",
      href: "/documentation/tools/networking",
    })
    expect(items.find((item) => item.title === "HR")).toMatchObject({
      status: "live",
      href: "/documentation/tools/hr",
    })
    expect(items.find((item) => item.title === "Finance")).toMatchObject({
      status: "live",
      href: "/documentation/tools/finance",
    })
    expect(items.find((item) => item.title === "Legal")).toMatchObject({
      status: "live",
      href: "/documentation/tools/legal",
    })
    expect(items.find((item) => item.title === "Campaigns")).toMatchObject({
      status: "live",
      href: "/documentation/tools/campaigns",
    })
    expect(items.find((item) => item.title === "CRM")).toMatchObject({
      status: "live",
      href: "/documentation/tools/crm",
    })
    expect(items.find((item) => item.title === "Marketplace")).toMatchObject({
      status: "live",
      href: "/documentation/marketplace",
    })
    expect(items.filter((item) => item.status !== "live" && item.href)).toEqual(
      []
    )
  })

  it("publishes a source-backed, non-ranked Marketplace catalog", () => {
    expect(MARKETPLACE_RESOURCES).toHaveLength(34)
    expect(new Set(MARKETPLACE_RESOURCES.map(({ id }) => id)).size).toBe(34)
    expect(new Set(MARKETPLACE_RESOURCES.map(({ url }) => url)).size).toBe(34)
    expect(MARKETPLACE_RESOURCES.map(({ type }) => type)).toEqual(
      expect.arrayContaining([
        "coaching",
        "software",
        "discount",
        "funding",
        "learning",
        "people",
        "professional-support",
      ])
    )
    for (const resource of MARKETPLACE_RESOURCES) {
      expect(resource.url).toMatch(/^https:\/\//)
      expect(["2026-09-03", "2026-09-04", "2026-09-15"]).toContain(
        resource.reviewedDate
      )
      expect(resource.reviewByDate >= resource.reviewedDate).toBe(true)
      expect(resource.description.length).toBeGreaterThan(50)
      expect(resource.eligibility.length).toBeGreaterThan(20)
      expect(resource.stages.length).toBeGreaterThan(0)
      expect(resource.functions.length).toBeGreaterThan(0)
    }
  })

  it("filters, sanitizes, and exports Marketplace work safely", () => {
    const filters = sanitizeMarketplaceFilters({
      query: "donor",
      type: "software",
      function: "fundraising",
      stage: "operating",
      cost: "paid-or-varies",
    })
    expect(
      filterMarketplaceResources(MARKETPLACE_RESOURCES, filters).map(
        ({ id }) => id
      )
    ).toEqual(["monkeypod", "venmo-charity-profiles", "little-green-light", "givebutter"])
    expect(
      sanitizeMarketplaceFilters({
        query: "q".repeat(200),
        type: "advertisement",
        function: "ranking",
        stage: "mature",
        cost: "guaranteed-free",
      })
    ).toEqual({
      query: "q".repeat(100),
      type: "all",
      function: "all",
      stage: "all",
      cost: "all",
    })
    expect(
      sanitizeMarketplaceShortlist([
        "givebutter",
        "not-published",
        "givebutter",
        42,
      ])
    ).toEqual(["givebutter"])

    const formulaResource = {
      ...MARKETPLACE_RESOURCES[0]!,
      id: "formula-test",
      name: "=SUM(A1:A2)",
    }
    expect(
      buildMarketplaceShortlistCsv(["formula-test"], [formulaResource])
    ).toContain("'=SUM(A1:A2)")
  })

  it("projects only safe, explicitly public Map profile fields", () => {
    const source = {
      id: "organization-1",
      name: "Public Organization",
      publicSlug: "public-organization",
      tagline: "A public tagline.",
      description: "A public description.",
      city: "Detroit",
      state: "MI",
      country: "United States",
      isOnlineOnly: false,
      primaryGroup: "community",
      programCount: 2,
      email: "private@example.org",
      phone: "555-0100",
      addressStreet: "Private street",
      latitude: 42,
      longitude: -83,
    }
    const [profile] = projectMarketplaceCommunityProfiles([source])

    expect(profile).toEqual({
      id: "organization-1",
      name: "Public Organization",
      slug: "public-organization",
      summary: "A public tagline.",
      location: "Detroit, MI",
      delivery: "Local or hybrid",
      group: "community",
      programCount: 2,
    })
    expect(profile).not.toHaveProperty("email")
    expect(profile).not.toHaveProperty("phone")
    expect(profile).not.toHaveProperty("addressStreet")
    expect(profile).not.toHaveProperty("latitude")
    expect(
      projectMarketplaceCommunityProfiles([
        { ...source, id: "private-shape", publicSlug: null },
      ])
    ).toEqual([])
  })

  it("publishes the public brand identity builder without an auth boundary", () => {
    const route = readSource(
      "src/app/(public)/documentation/tools/brand-identity/page.tsx"
    )
    const legacyRoute = readSource(
      "src/app/(public)/documentation/toolbox/brand-identity/page.tsx"
    )
    const tool = readSource(
      "src/features/nonprofit-documentation/components/brand-identity/brand-identity-tool.tsx"
    )
    const hook = readSource(
      "src/features/nonprofit-documentation/hooks/use-brand-identity-tool.ts"
    )

    expect(BRAND_IDENTITY_PATH).toBe("/documentation/tools/brand-identity")
    expect(route).toContain("<BrandIdentityTool />")
    expect(route).toContain('canonical: "/documentation/tools/brand-identity"')
    expect(legacyRoute).toContain("redirect(BRAND_IDENTITY_PATH)")
    expect(tool).toContain('"@type": "WebApplication"')
    expect(tool).toContain("No account required")
    expect(tool).toContain("Private to this browser")
    expect(tool).toContain("<DocumentationSurface")
    expect(hook).toContain("window.localStorage")
    expect(hook).toContain("loadBrandAssets")
    expect(tool).not.toContain("hasActiveSubscription")
  })

  it("computes valid accessible brand values and portable tokens", () => {
    expect(normalizeHex("#abc")).toBe("#AABBCC")
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5)
    expect(contrastRating(7)).toBe("AAA")
    expect(contrastRating(4.5)).toBe("AA")
    expect(contrastRating(4.49)).toBe("Fail")

    const proportions = normalizeProportions([
      ...DEFAULT_BRAND_IDENTITY_DRAFT.colors.slice(0, 3),
      { ...DEFAULT_BRAND_IDENTITY_DRAFT.colors[3], proportion: 30 },
    ])
    expect(
      proportions.reduce((sum, color) => sum + color.proportion, 0)
    ).toBeCloseTo(100, 2)

    const scale = typeScale(16, 1.25)
    expect(scale.body).toBe(16)
    expect(scale.h1).toBeCloseTo(31.25, 2)
    const tokens = buildBrandTokens(DEFAULT_BRAND_IDENTITY_DRAFT)
    expect(tokens).toContain("--brand-canvas: #F3F0E8;")
    expect(tokens).toContain("--brand-type-h1: 31.25px;")
  })

  it("uses fixed palette roles, optional names, and portable fonts", () => {
    expect(
      DEFAULT_BRAND_IDENTITY_DRAFT.colors.map(({ role, name }) => ({
        role,
        name,
      }))
    ).toEqual([
      { role: "Background", name: "" },
      { role: "Primary", name: "" },
      { role: "Secondary", name: "" },
      { role: "Text", name: "" },
    ])
    expect(brandColorLabel(DEFAULT_BRAND_IDENTITY_DRAFT.colors[0])).toBe(
      "Background"
    )
    expect(
      brandColorLabel({
        ...DEFAULT_BRAND_IDENTITY_DRAFT.colors[0],
        name: "Harbor Blue",
      })
    ).toBe("Background — Harbor Blue")
    expect(BRAND_FONT_OPTIONS.length).toBeGreaterThanOrEqual(19)
    expect(BRAND_FONT_GROUPS.map((group) => group.label)).toEqual([
      "Sans serif",
      "Display",
    ])
    expect(brandFontStack("Georgia")).toBe(brandFontStack("System Sans"))
    expect(
      sanitizeBrandDraft({
        headingFont: "Georgia",
        bodyFont: "Times New Roman",
      })
    ).toMatchObject({ headingFont: "System Sans", bodyFont: "System Sans" })
    expect(
      BRAND_FONT_OPTIONS.every((font) => font.stack.endsWith("sans-serif"))
    ).toBe(true)

    for (const legacyName of ["Community cream", "Warm canvas"]) {
      const migrated = sanitizeBrandDraft({
        ...DEFAULT_BRAND_IDENTITY_DRAFT,
        colors: DEFAULT_BRAND_IDENTITY_DRAFT.colors.map((color) =>
          color.id === "canvas" ? { ...color, name: legacyName } : color
        ),
      })
      expect(migrated.colors[0]).toMatchObject({
        role: "Background",
        name: "",
      })
    }
  })

  it("creates a valid browser ZIP archive for public downloads", () => {
    const archive = createBrowserZip([
      { name: "README.txt", data: new TextEncoder().encode("Coach House") },
      { name: "brand/tokens.css", data: new TextEncoder().encode(":root {}") },
    ])
    const view = new DataView(archive.buffer)

    expect(view.getUint32(0, true)).toBe(0x04034b50)
    expect(view.getUint32(archive.length - 22, true)).toBe(0x06054b50)
    expect(view.getUint16(archive.length - 12, true)).toBe(2)
  })

  it("publishes complete stage-specific foundation guides", () => {
    for (const guide of [QUICKSTART_GUIDE, KEY_CONCEPTS_GUIDE]) {
      expect(guide.stages.map((stage) => stage.id)).toEqual([
        "exploring",
        "forming",
        "operating",
        "growing",
      ])
      expect(guide.sections.length).toBeGreaterThanOrEqual(2)
      expect(guide.checklist.length).toBeGreaterThanOrEqual(6)
      expect(guide.sources.length).toBeGreaterThanOrEqual(3)
      expect(
        guide.sources.every((source) =>
          source.url.startsWith("https://www.irs.gov/")
        )
      ).toBe(true)
    }
  })

  it("provides complete stage-specific mission guidance", () => {
    expect(MISSION_ARTICLE.stages.map((stage) => stage.id)).toEqual([
      "exploring",
      "forming",
      "operating",
      "growing",
    ])
    expect(MISSION_ARTICLE.framework).toHaveLength(5)
    expect(MISSION_ARTICLE.checklist.length).toBeGreaterThanOrEqual(6)
    expect(MISSION_ARTICLE.mistakes.length).toBeGreaterThanOrEqual(4)
    expect(MISSION_ARTICLE.measures.length).toBeGreaterThanOrEqual(5)
    expect(MISSION_ARTICLE.sources.length).toBeGreaterThanOrEqual(3)
    expect(
      MISSION_ARTICLE.sources.every((source) =>
        source.url.startsWith("https://www.irs.gov/")
      )
    ).toBe(true)
  })

  it("publishes complete source-backed compliance guidance", () => {
    expect(COMPLIANCE_ARTICLE.stages.map((stage) => stage.id)).toEqual([
      "exploring",
      "forming",
      "operating",
      "growing",
    ])
    expect(COMPLIANCE_ARTICLE.framework).toHaveLength(6)
    expect(COMPLIANCE_ARTICLE.checklist.length).toBeGreaterThanOrEqual(8)
    expect(COMPLIANCE_ARTICLE.mistakes.length).toBeGreaterThanOrEqual(5)
    expect(COMPLIANCE_ARTICLE.measures.length).toBeGreaterThanOrEqual(5)
    expect(COMPLIANCE_ARTICLE.sources.length).toBeGreaterThanOrEqual(7)
    expect(COMPLIANCE_ARTICLE.disclaimer).toContain(
      "does not determine whether"
    )
    expect(
      COMPLIANCE_ARTICLE.sources.every((source) =>
        source.url.startsWith("https://www.irs.gov/")
      )
    ).toBe(true)
  })

  it("builds a cautious device-local compliance planning rhythm", () => {
    expect(
      commonFederalFilingPath("normally-50k-or-less", "under-500k").form
    ).toBe("Form 990-N may be available")
    expect(commonFederalFilingPath("under-200k", "under-500k").form).toBe(
      "Form 990-EZ or Form 990"
    )
    expect(commonFederalFilingPath("under-200k", "500k-or-more").form).toBe(
      "Form 990"
    )
    expect(nominalAnnualReturnDueDate("2026-12-31")).toEqual({
      iso: "2027-05-15",
      label: "May 15, 2027",
    })

    const draft = {
      ...DEFAULT_COMPLIANCE_RHYTHM,
      stateCode: "NY",
      taxYearEnd: "2026-12-31",
      hasEmployees: true,
    }
    const tasks = buildComplianceTasks(draft)
    expect(tasks.map((task) => task.id)).toEqual(
      expect.arrayContaining([
        "federal-annual-return",
        "state-entity-report",
        "charitable-solicitation",
        "employment-taxes",
      ])
    )
    expect(
      tasks.find((task) => task.id === "state-entity-report")?.task
    ).toContain("New York")
    expect(buildComplianceCsv(draft)).toContain(
      '"Category","Status","Task","Timing","Evidence"'
    )
    expect(sanitizeComplianceRhythm({ stateCode: "XX" }).stateCode).toBe("")
  })

  it("publishes complete source-backed fundraising guidance", () => {
    expect(FUNDRAISING_ARTICLE.stages.map((stage) => stage.id)).toEqual([
      "exploring",
      "forming",
      "operating",
      "growing",
    ])
    expect(FUNDRAISING_ARTICLE.framework).toHaveLength(7)
    expect(FUNDRAISING_ARTICLE.checklist.length).toBeGreaterThanOrEqual(9)
    expect(FUNDRAISING_ARTICLE.mistakes.length).toBeGreaterThanOrEqual(6)
    expect(FUNDRAISING_ARTICLE.measures.length).toBeGreaterThanOrEqual(6)
    expect(FUNDRAISING_ARTICLE.sources.length).toBeGreaterThanOrEqual(8)
    expect(FUNDRAISING_ARTICLE.answer).toContain("honoring every promise")
    expect(FUNDRAISING_ARTICLE.disclaimer).toContain("does not determine")
    expect(
      FUNDRAISING_ARTICLE.sources.map(({ publisher }) => publisher)
    ).toEqual(
      expect.arrayContaining([
        "Coach House",
        "Internal Revenue Service",
        "Grants.gov",
        "SAM.gov",
        "Association of Fundraising Professionals",
        "National Council of Nonprofits",
      ])
    )
  })

  it("builds a transparent device-local fundraising plan", () => {
    const draft = {
      ...DEFAULT_FUNDRAISING_PLAN,
      organizationName: "East Harbor Youth Arts",
      stage: "operating" as const,
      fundingGoal: 120_000,
      committedFunds: 30_000,
      channelTargets: {
        individuals: 35_000,
        foundations: 25_000,
        government: 10_000,
        corporate: 10_000,
        events: 10_000,
      },
      hasCaseForSupport: true,
      hasGiftAcknowledgmentProcess: true,
    }
    expect(summarizeFundraisingPlan(draft)).toEqual({
      fundingNeed: 90_000,
      plannedTotal: 90_000,
      remainingGap: 0,
      overplannedAmount: 0,
      monthlyPace: 7_500,
    })
    expect(buildFundraisingActions(draft).map(({ id }) => id)).toEqual(
      expect.arrayContaining([
        "operating-review",
        "channel-individuals",
        "channel-foundations",
        "channel-government",
        "channel-corporate",
        "channel-events",
      ])
    )
    expect(buildFundraisingCsv(draft)).toContain(
      '"Channel","Planned amount","Share of fundraising need"'
    )
    expect(
      buildFundraisingCsv({ ...draft, organizationName: "=SUM(A1:A2)" })
    ).toContain("'=SUM(A1:A2)")
    expect(
      sanitizeFundraisingPlan({
        stage: "unknown",
        periodMonths: 7,
        fundingGoal: -100,
      })
    ).toMatchObject({
      stage: "exploring",
      periodMonths: 12,
      fundingGoal: 0,
    })
  })

  it("publishes complete source-backed nonprofit marketing guidance", () => {
    expect(MARKETING_ARTICLE.stages.map((stage) => stage.id)).toEqual([
      "exploring",
      "forming",
      "operating",
      "growing",
    ])
    expect(MARKETING_ARTICLE.framework).toHaveLength(7)
    expect(MARKETING_ARTICLE.checklist.length).toBeGreaterThanOrEqual(9)
    expect(MARKETING_ARTICLE.mistakes.length).toBeGreaterThanOrEqual(6)
    expect(MARKETING_ARTICLE.measures.length).toBeGreaterThanOrEqual(6)
    expect(MARKETING_ARTICLE.sources.length).toBeGreaterThanOrEqual(9)
    expect(MARKETING_ARTICLE.answer).toContain("specific audience")
    expect(MARKETING_ARTICLE.disclaimer).toContain("does not determine")
    expect(MARKETING_ARTICLE.sources.map(({ publisher }) => publisher)).toEqual(
      expect.arrayContaining([
        "Coach House",
        "Centers for Disease Control and Prevention",
        "U.S. Department of Justice",
        "World Wide Web Consortium",
        "Federal Trade Commission",
        "U.S. Copyright Office",
        "Internal Revenue Service",
        "Google Analytics Help",
      ])
    )
  })

  it("builds a guarded device-local 90-day marketing plan", () => {
    const draft = {
      ...DEFAULT_MARKETING_PLAN,
      organizationName: "Willow Street Family Resource Network",
      campaignName: "Know your options",
      stage: "operating" as const,
      objective: "service-access" as const,
      primaryAudience: "Adults in three service ZIP codes",
      mainMessage: "Free navigation appointments are available.",
      proofPoint: "The reviewed program page confirms current availability.",
      invitation: "Review eligibility and request an appointment.",
      channelCadence: {
        email: 1,
        website: 1,
        social: 8,
        partners: 2,
        events: 1,
        media: 0,
      },
      hasStoryPermissionProcess: true,
      hasContentReviewProcess: true,
      hasLinkTrackingConvention: true,
    }
    expect(summarizeMarketingPlan(draft)).toEqual({
      activeChannelCount: 5,
      monthlyOutputs: 13,
      ninetyDayOutputs: 39,
      weeklyPace: 3,
      hasCoreBrief: true,
    })
    expect(buildMarketingActions(draft).map(({ id }) => id)).toEqual(
      expect.arrayContaining([
        "operating-rhythm",
        "operating-learn",
        "channel-email",
        "channel-website",
        "channel-social",
        "channel-partners",
        "channel-events",
      ])
    )
    expect(buildMarketingAiPrompt(draft)).toContain(
      "Do not invent facts, statistics, quotes, outcomes, dates, permissions"
    )
    expect(buildMarketingAiPrompt(draft)).toContain(
      "Primary audience: Adults in three service ZIP codes"
    )
    expect(buildMarketingCsv(draft)).toContain(
      '"Channel","Planned outputs per month","Planned outputs in 90 days"'
    )
    expect(
      buildMarketingCsv({ ...draft, campaignName: "=SUM(A1:A2)" })
    ).toContain("'=SUM(A1:A2)")
    expect(
      sanitizeMarketingPlan({
        stage: "unknown",
        objective: "go-viral",
        primaryAudience: "a".repeat(400),
        channelCadence: { social: 400, email: -2 },
      })
    ).toMatchObject({
      stage: "exploring",
      objective: "community-awareness",
      primaryAudience: "a".repeat(280),
      channelCadence: expect.objectContaining({ social: 100, email: 0 }),
    })
  })

  it("publishes complete source-backed nonprofit framework guidance", () => {
    expect(FRAMEWORKS_ARTICLE.stages.map((stage) => stage.id)).toEqual([
      "exploring",
      "forming",
      "operating",
      "growing",
    ])
    expect(FRAMEWORKS_ARTICLE.framework).toHaveLength(5)
    expect(FRAMEWORKS_ARTICLE.checklist.length).toBeGreaterThanOrEqual(9)
    expect(FRAMEWORKS_ARTICLE.mistakes.length).toBeGreaterThanOrEqual(6)
    expect(FRAMEWORKS_ARTICLE.measures.length).toBeGreaterThanOrEqual(6)
    expect(FRAMEWORKS_ARTICLE.sources.length).toBeGreaterThanOrEqual(8)
    expect(FRAMEWORKS_ARTICLE.answer).toContain("structured way")
    expect(FRAMEWORKS_ARTICLE.disclaimer).toContain("do not determine")
    expect(
      FRAMEWORKS_ARTICLE.sources.map(({ publisher }) => publisher)
    ).toEqual(
      expect.arrayContaining([
        "Coach House",
        "Centers for Disease Control and Prevention",
        "AmeriCorps",
        "U.S. Agency for International Development",
        "Minnesota Department of Health",
      ])
    )
  })

  it("builds a guarded device-local logic model", () => {
    const draft = {
      ...DEFAULT_LOGIC_MODEL_DRAFT,
      organizationName: "Willow Street Family Resource Network",
      programName: "Neighborhood legal navigation pilot",
      stage: "forming" as const,
      primaryQuestion: "plan-program" as const,
      need: "Residents report uncertainty about trusted help.",
      people: "Adults in three service ZIP codes.",
      inputs: "Two trained navigators and partner referrals.",
      activities: "Offer bilingual navigation appointments.",
      outputs: "Appointments and referrals completed.",
      nearTermOutcomes: "Residents better understand their options.",
      intermediateOutcomes: "More residents complete timely next steps.",
      longTermContribution: "More timely problem resolution.",
      assumptions: "Appointments and referrals have sufficient capacity.",
      context: "Rules, housing conditions, and legal capacity may change.",
      learningQuestion: "Which barriers prevent referral completion?",
    }
    expect(summarizeLogicModel(draft)).toEqual({
      draftedAreaCount: 11,
      totalAreaCount: 11,
      causalLinkCount: 5,
      hasCompletePathway: true,
    })
    expect(recommendedFramework(draft.primaryQuestion).id).toBe("logic-model")
    expect(buildLogicModelActions(draft).map(({ id }) => id)).toEqual([
      "forming-align",
      "framework-logic-model",
    ])
    expect(buildLogicModelReviewPrompt(draft)).toContain(
      "Do not invent facts, statistics, quotes, outcomes, causal relationships"
    )
    expect(buildLogicModelReviewPrompt(draft)).toContain(
      "This review does not validate causality"
    )
    expect(buildLogicModelCsv(draft)).toContain('"Area","Working draft"')
    expect(
      buildLogicModelCsv({ ...draft, programName: "=SUM(A1:A2)" })
    ).toContain("'=SUM(A1:A2)")
    expect(
      sanitizeLogicModelDraft({
        stage: "unknown",
        primaryQuestion: "make-us-successful",
        need: "a".repeat(900),
      })
    ).toMatchObject({
      stage: "exploring",
      primaryQuestion: "plan-program",
      need: "a".repeat(800),
    })
  })

  it("publishes complete source-backed nonprofit impact guidance", () => {
    expect(MEASURING_IMPACT_ARTICLE.stages.map((stage) => stage.id)).toEqual([
      "exploring",
      "forming",
      "operating",
      "growing",
    ])
    expect(MEASURING_IMPACT_ARTICLE.framework).toHaveLength(7)
    expect(MEASURING_IMPACT_ARTICLE.checklist.length).toBeGreaterThanOrEqual(10)
    expect(MEASURING_IMPACT_ARTICLE.mistakes.length).toBeGreaterThanOrEqual(7)
    expect(MEASURING_IMPACT_ARTICLE.measures.length).toBeGreaterThanOrEqual(7)
    expect(MEASURING_IMPACT_ARTICLE.sources.length).toBeGreaterThanOrEqual(8)
    expect(MEASURING_IMPACT_ARTICLE.answer).toContain("intended user and use")
    expect(MEASURING_IMPACT_ARTICLE.disclaimer).toContain("do not determine")
    expect(
      MEASURING_IMPACT_ARTICLE.sources.map(({ publisher }) => publisher)
    ).toEqual(
      expect.arrayContaining([
        "Coach House",
        "Centers for Disease Control and Prevention",
        "AmeriCorps",
        "Federal Trade Commission",
      ])
    )
  })

  it("builds a guarded device-local measurement plan", () => {
    const draft = {
      ...DEFAULT_MEASUREMENT_PLAN,
      organizationName: "Willow Street Family Resource Network",
      programName: "Neighborhood legal navigation pilot",
      stage: "forming" as const,
      decision: "assess-near-term-outcome" as const,
      outcomeStatement: "Participants better understand available options.",
      evaluationQuestion: "How does understanding change within 30 days?",
      indicatorDefinition: "Number and percentage who name a next step.",
      method: "mixed-methods" as const,
      dataSource: "Appointment records, follow-up, and interviews.",
      collectionSchedule: "Follow up after 30 days and review quarterly.",
      expectedRespondents: 40,
      minutesPerResponse: 5,
      cyclesPerYear: 4,
      disaggregationPlan: "Review safe relevant variation and missingness.",
      limitations: "Respondents may differ from people not reached.",
      owner: "Program director and participant advisory group.",
      actionRule: "Investigate access barriers before expansion.",
      hasDataMinimizationReview: true,
      hasAccessibleVoluntaryProcess: true,
      hasParticipantInterpretation: true,
    }
    expect(summarizeMeasurementPlan(draft)).toEqual({
      draftedAreaCount: 8,
      totalAreaCount: 8,
      annualResponses: 160,
      annualRespondentHours: 13.3,
      hasDecisionReadyChain: true,
    })
    expect(buildMeasurementPlanActions(draft).map(({ id }) => id)).toEqual([
      "stage-forming",
    ])
    expect(buildMeasurementReviewPrompt(draft)).toContain(
      "Do not invent facts, statistics, definitions, baselines, benchmarks"
    )
    expect(buildMeasurementReviewPrompt(draft)).toContain(
      "does not validate the method, data, causality"
    )
    expect(buildMeasurementPlanCsv(draft)).toContain(
      '\"Area\",\"Working plan\"'
    )
    expect(
      buildMeasurementPlanCsv({ ...draft, programName: "=SUM(A1:A2)" })
    ).toContain("'=SUM(A1:A2)")
    expect(
      sanitizeMeasurementPlan({
        stage: "unknown",
        decision: "make-us-successful",
        expectedRespondents: -4,
        minutesPerResponse: 5000,
        outcomeStatement: "a".repeat(900),
      })
    ).toMatchObject({
      stage: "exploring",
      decision: "improve-delivery",
      expectedRespondents: 0,
      minutesPerResponse: 1440,
      outcomeStatement: "a".repeat(800),
    })
  })

  it("publishes complete source-backed nonprofit sustainability guidance", () => {
    expect(SUSTAINABILITY_ARTICLE.stages.map((stage) => stage.id)).toEqual([
      "exploring",
      "forming",
      "operating",
      "growing",
    ])
    expect(SUSTAINABILITY_ARTICLE.framework).toHaveLength(7)
    expect(SUSTAINABILITY_ARTICLE.checklist.length).toBeGreaterThanOrEqual(11)
    expect(SUSTAINABILITY_ARTICLE.mistakes.length).toBeGreaterThanOrEqual(7)
    expect(SUSTAINABILITY_ARTICLE.measures.length).toBeGreaterThanOrEqual(7)
    expect(SUSTAINABILITY_ARTICLE.sources.length).toBeGreaterThanOrEqual(9)
    expect(SUSTAINABILITY_ARTICLE.answer).toContain(
      "maintain valued mission benefits"
    )
    expect(SUSTAINABILITY_ARTICLE.disclaimer).toContain("do not determine")
    expect(
      SUSTAINABILITY_ARTICLE.sources.map(({ publisher }) => publisher)
    ).toEqual(
      expect.arrayContaining([
        "Coach House",
        "Centers for Disease Control and Prevention",
        "Internal Revenue Service",
        "Ready.gov",
        "National Council of Nonprofits",
      ])
    )
  })

  it("builds a guarded device-local sustainability scenario", () => {
    const draft = {
      ...DEFAULT_SUSTAINABILITY_PLAN,
      organizationName: "Willow Street Family Resource Network",
      initiativeName: "Neighborhood legal navigation pilot",
      stage: "operating" as const,
      direction: "stabilize" as const,
      horizonMonths: 12 as const,
      unrestrictedCash: 45_000,
      expectedUnrestrictedRevenue: 150_000,
      restrictedFunds: 120_000,
      monthlyCoreCosts: 9_000,
      monthlyProgramCosts: 6_000,
      weeklyAvailableHours: 120,
      weeklyCommittedHours: 132,
      missionPriority: "Maintain trusted bilingual navigation.",
      essentialCommitments: "Navigators, supervision, access, and systems.",
      fundingAssumptions: "Restricted grant excludes shared costs.",
      peopleDependencies: "Two staff hold key referral knowledge.",
      systemsDependencies: "Scheduling, records, and partners.",
      adaptationTriggers: "Pause expansion if capacity remains negative.",
      continuityOwner: "Executive director and board treasurer.",
      reviewRhythm: "Monthly staff and quarterly board review.",
      hasBoardFinancialReview: true,
      hasRestrictionReview: true,
      hasContinuityPlan: false,
    }
    expect(summarizeSustainabilityPlan(draft)).toEqual({
      monthlyPlannedCost: 15_000,
      horizonPlannedCost: 180_000,
      flexibleResources: 195_000,
      projectedFlexibleBalance: 15_000,
      startingRunwayMonths: 3,
      weeklyCapacityBalance: -12,
      draftedAreaCount: 8,
      totalAreaCount: 8,
      hasReviewableScenario: true,
    })
    expect(buildSustainabilityActions(draft).map(({ id }) => id)).toEqual([
      "stage-operating",
      "capacity-gap",
      "governance-review",
    ])
    expect(buildSustainabilityReviewPrompt(draft)).toContain(
      "Do not invent revenue, expenses, cash timing, restrictions"
    )
    expect(buildSustainabilityReviewPrompt(draft)).toContain(
      "does not validate sustainability, solvency, liquidity"
    )
    expect(buildSustainabilityCsv(draft)).toContain('"Area","Working scenario"')
    expect(
      buildSustainabilityCsv({ ...draft, initiativeName: "=SUM(A1:A2)" })
    ).toContain("'=SUM(A1:A2)")
    expect(
      sanitizeSustainabilityPlan({
        stage: "unknown",
        direction: "always-grow",
        horizonMonths: 15,
        unrestrictedCash: -2,
        weeklyCommittedHours: 200_000,
        missionPriority: "a".repeat(900),
      })
    ).toMatchObject({
      stage: "exploring",
      direction: "stabilize",
      horizonMonths: 12,
      unrestrictedCash: 0,
      weeklyCommittedHours: 100_000,
      missionPriority: "a".repeat(800),
    })
  })

  it("publishes complete source-backed nonprofit partnership guidance", () => {
    expect(PARTNERSHIPS_ARTICLE.stages.map((stage) => stage.id)).toEqual([
      "exploring",
      "forming",
      "operating",
      "growing",
    ])
    expect(PARTNERSHIPS_ARTICLE.framework).toHaveLength(7)
    expect(PARTNERSHIPS_ARTICLE.checklist.length).toBeGreaterThanOrEqual(13)
    expect(PARTNERSHIPS_ARTICLE.mistakes.length).toBeGreaterThanOrEqual(8)
    expect(PARTNERSHIPS_ARTICLE.measures.length).toBeGreaterThanOrEqual(7)
    expect(PARTNERSHIPS_ARTICLE.sources.length).toBeGreaterThanOrEqual(10)
    expect(PARTNERSHIPS_ARTICLE.answer).toContain("shared public purpose")
    expect(PARTNERSHIPS_ARTICLE.disclaimer).toContain("do not recommend")
    expect(
      PARTNERSHIPS_ARTICLE.sources.map(({ publisher }) => publisher)
    ).toEqual(
      expect.arrayContaining([
        "Coach House",
        "Centers for Disease Control and Prevention",
        "Internal Revenue Service",
        "U.S. Department of Justice",
        "Federal Trade Commission",
        "National Council of Nonprofits",
      ])
    )
  })

  it("builds a guarded device-local partnership brief", () => {
    const draft = {
      ...DEFAULT_PARTNERSHIP_BRIEF,
      organizationName: "Willow Street Family Resource Network",
      partnerName: "Harbor County Legal Aid",
      partnershipName: "Neighborhood legal navigation pathway",
      stage: "operating" as const,
      model: "co-delivery" as const,
      termMonths: 12 as const,
      reviewEveryMonths: 3 as const,
      sharedPurpose: "Create an accessible legal-navigation pathway.",
      communityRole: "Resident advisors review access and findings.",
      organizationContribution: "Bilingual navigation and trusted space.",
      partnerContribution: "Legal expertise and qualified referrals.",
      jointActivities: "Training, workshops, referrals, and review.",
      intendedResult: "Residents complete an appropriate next step.",
      decisionRights: "Each party controls its services and records.",
      financialTerms: "Each party tracks full cost.",
      dataBoundaries: "Aggregate learning only without reviewed authority.",
      communicationRhythm: "Monthly lead and quarterly community review.",
      conflictPath: "Escalate material issues to authorized leaders.",
      closeoutPlan: "Decide at month ten and protect open referrals.",
      organizationLead: "Program director.",
      partnerLead: "Partnerships attorney.",
      hasConflictReview: true,
      hasDataReview: true,
      hasAccessibilityPlan: true,
      hasAuthorizedApproval: false,
    }
    expect(summarizePartnershipBrief(draft)).toEqual({
      draftedAreaCount: 14,
      totalAreaCount: 14,
      reviewMomentCount: 4,
      safeguardCount: 3,
      totalSafeguardCount: 4,
      hasReviewableBrief: true,
    })
    expect(buildPartnershipBriefActions(draft).map(({ id }) => id)).toEqual([
      "stage-operating",
      "remaining-safeguards",
    ])
    expect(buildPartnershipReviewPrompt(draft)).toContain(
      "Do not invent facts, partner interest, authority, consent"
    )
    expect(buildPartnershipReviewPrompt(draft)).toContain(
      "does not recommend a partner, score trust or equity"
    )
    expect(buildPartnershipBriefCsv(draft)).toContain(
      '"Area","Working partnership brief"'
    )
    expect(
      buildPartnershipBriefCsv({ ...draft, partnerName: "=SUM(A1:A2)" })
    ).toContain("'=SUM(A1:A2)")
    expect(
      sanitizePartnershipBrief({
        stage: "unknown",
        model: "automatic-merger",
        termMonths: 60,
        reviewEveryMonths: 2,
        sharedPurpose: "a".repeat(1100),
      })
    ).toMatchObject({
      stage: "exploring",
      model: "referral",
      termMonths: 6,
      reviewEveryMonths: 3,
      sharedPurpose: "a".repeat(1000),
    })
  })

  it("publishes complete source-backed nonprofit social media guidance", () => {
    expect(SOCIAL_MEDIA_ARTICLE.stages.map((stage) => stage.id)).toEqual([
      "exploring",
      "forming",
      "operating",
      "growing",
    ])
    expect(SOCIAL_MEDIA_ARTICLE.slug).toBe("tools/social-media")
    expect(SOCIAL_MEDIA_ARTICLE.framework).toHaveLength(7)
    expect(SOCIAL_MEDIA_ARTICLE.checklist.length).toBeGreaterThanOrEqual(12)
    expect(SOCIAL_MEDIA_ARTICLE.mistakes.length).toBeGreaterThanOrEqual(8)
    expect(SOCIAL_MEDIA_ARTICLE.measures.length).toBeGreaterThanOrEqual(7)
    expect(SOCIAL_MEDIA_ARTICLE.sources.length).toBeGreaterThanOrEqual(9)
    expect(SOCIAL_MEDIA_ARTICLE.answer).toContain("specific audience need")
    expect(SOCIAL_MEDIA_ARTICLE.disclaimer).toContain("do not publish")
    expect(
      SOCIAL_MEDIA_ARTICLE.sources.map(({ publisher }) => publisher)
    ).toEqual(
      expect.arrayContaining([
        "Coach House",
        "Internal Revenue Service",
        "Federal Trade Commission",
        "World Wide Web Consortium",
        "U.S. Department of Justice",
        "U.S. Copyright Office",
        "LinkedIn Help",
        "YouTube Help",
      ])
    )
  })

  it("builds a guarded device-local social media brief", () => {
    const draft = {
      ...DEFAULT_SOCIAL_MEDIA_PLAN,
      organizationName: "Willow Street Family Resource Network",
      campaignName: "Know your options",
      stage: "operating" as const,
      objective: "service-access" as const,
      campaignWeeks: 8 as const,
      primaryAudience: "Adults in three service ZIP codes.",
      desiredAction: "Request a navigation appointment.",
      destinationUrl: "https://example.org/appointments?language=en",
      mainMessage: "Free bilingual navigation appointments are available.",
      sourceEvidence: "Reviewed program page dated August 28, 2026.",
      storyPermissionContext: "No participant story or image is used.",
      voiceGuidance: "Plain, calm, specific, and bilingual.",
      postCopy: "Review eligibility for a free navigation appointment.",
      visualDescription: "A text-led service information card.",
      alternativeText: "Free navigation appointment service card.",
      captionsPlan: "Reviewed open captions and a transcript for video.",
      linkLabel: "Review eligibility and request an appointment",
      responseProtocol: "Move service questions to the secure request form.",
      approvalOwner: "Program director.",
      escalationOwner: "Executive director.",
      previewChannel: "instagram" as const,
      channelCadence: {
        instagram: 2,
        facebook: 1,
        linkedin: 1,
        tiktok: 0,
        youtube: 0,
        bluesky: 0,
        other: 0,
      },
      hasStoryPermissionReview: true,
      hasClaimSourceReview: true,
      hasAccessibilityReview: true,
      hasApprovalEscalationPlan: false,
    }
    expect(summarizeSocialMediaPlan(draft)).toEqual({
      activeChannelCount: 3,
      weeklyOutputs: 4,
      campaignOutputs: 32,
      draftedAreaCount: 15,
      totalAreaCount: 15,
      safeguardCount: 3,
      totalSafeguardCount: 4,
    })
    expect(buildSocialMediaActions(draft).map(({ id }) => id)).toEqual([
      "stage-operating",
      "remaining-safeguards",
    ])
    expect(buildSocialMediaReviewPrompt(draft)).toContain(
      "Do not invent facts, outcomes, quotes, dates, links, permissions"
    )
    expect(buildSocialMediaReviewPrompt(draft)).toContain(
      "Do not publish, approve, score, predict performance"
    )
    expect(
      buildTrackedSocialUrl(
        draft.destinationUrl,
        draft.previewChannel,
        draft.campaignName
      )
    ).toEqual({
      ok: true,
      url: "https://example.org/appointments?language=en&utm_source=instagram&utm_medium=social&utm_campaign=know-your-options",
    })
    expect(
      buildTrackedSocialUrl("javascript:alert(1)", "other", "Test")
    ).toEqual({
      ok: false,
      error: "Only HTTP and HTTPS destinations are used.",
    })
    expect(buildSocialMediaCsv(draft)).toContain(
      '"Channel","User-entered outputs per week","Campaign outputs"'
    )
    expect(
      buildSocialMediaCsv({ ...draft, campaignName: "=SUM(A1:A2)" })
    ).toContain("'=SUM(A1:A2)")
    expect(
      sanitizeSocialMediaPlan({
        stage: "unknown",
        objective: "go-viral",
        campaignWeeks: 52,
        previewChannel: "x",
        primaryAudience: "a".repeat(600),
        channelCadence: { instagram: 400, facebook: -2 },
      })
    ).toMatchObject({
      stage: "exploring",
      objective: "community-education",
      campaignWeeks: 8,
      previewChannel: "instagram",
      primaryAudience: "a".repeat(400),
      channelCadence: expect.objectContaining({ instagram: 100, facebook: 0 }),
    })
  })

  it("publishes complete source-backed nonprofit networking guidance", () => {
    expect(NETWORKING_ARTICLE.stages.map((stage) => stage.id)).toEqual([
      "exploring",
      "forming",
      "operating",
      "growing",
    ])
    expect(NETWORKING_ARTICLE.slug).toBe("tools/networking")
    expect(NETWORKING_ARTICLE.framework).toHaveLength(7)
    expect(NETWORKING_ARTICLE.checklist.length).toBeGreaterThanOrEqual(12)
    expect(NETWORKING_ARTICLE.mistakes.length).toBeGreaterThanOrEqual(8)
    expect(NETWORKING_ARTICLE.measures.length).toBeGreaterThanOrEqual(7)
    expect(NETWORKING_ARTICLE.sources.length).toBeGreaterThanOrEqual(10)
    expect(NETWORKING_ARTICLE.answer).toContain(
      "repeatable relationship practice"
    )
    expect(NETWORKING_ARTICLE.disclaimer).toContain("do not identify")
    expect(
      NETWORKING_ARTICLE.sources.map(({ publisher }) => publisher)
    ).toEqual(
      expect.arrayContaining([
        "Coach House",
        "CDC and Agency for Toxic Substances and Disease Registry",
        "Agency for Toxic Substances and Disease Registry",
        "University of Kansas Community Tool Box",
        "Federal Trade Commission",
        "U.S. Department of Justice",
        "Internal Revenue Service",
      ])
    )
  })

  it("builds a guarded device-local nonprofit relationship map", () => {
    const draft = {
      ...DEFAULT_NETWORKING_PLAN,
      organizationName: "Willow Street Family Resource Network",
      initiativeName: "Current referral pathway review",
      stage: "operating" as const,
      objective: "referral-pathway" as const,
      reviewWeeks: 8 as const,
      networkingPurpose: "Improve the current referral pathway.",
      communityAccountability: "Resident advisors shape and review decisions.",
      existingAssets: "Resident advisors and bilingual navigators.",
      relationshipGaps: "Disability-led access review and capacity updates.",
      invitation: "Request a bounded listening conversation.",
      followUpRhythm: "Close loops within three business days.",
      accessPlan: "Offer accessible English and Spanish options.",
      dataBoundary: "Store minimum organization-level context only.",
      planOwner: "Community partnerships manager.",
      escalationPath: "Escalate sensitive commitments before acting.",
      relationships: [
        {
          id: "resident-circle",
          label: "Resident advisory circle",
          category: "community" as const,
          engagement: "listen" as const,
          purpose: "Define referral barriers.",
          theirContext: "Residents hold direct experience.",
          responsibleOffer: "Compensation and decision follow-up.",
          nextStep: "Review the listening questions.",
          owner: "Community partnerships manager",
          reviewTiming: "Before outreach",
        },
        {
          id: "legal-aid",
          label: "County legal-aid intake team",
          category: "peer-nonprofit" as const,
          engagement: "coordinate" as const,
          purpose: "Clarify referral fit and capacity.",
          theirContext: "Eligibility and professional duties apply.",
          responsibleOffer: "Reviewed navigation information.",
          nextStep: "Hold an intake-pathway review.",
          owner: "Program director",
          reviewTiming: "Within three weeks",
        },
        {
          id: "funder",
          label: "Regional funder program team",
          category: "funder" as const,
          engagement: "learn" as const,
          purpose: "Learn current funding fit.",
          theirContext: "Priorities and timing require confirmation.",
          responsibleOffer: "Concise need and learning context.",
          nextStep: "Request a brief fit conversation.",
          owner: "Executive director",
          reviewTiming: "After resident review",
        },
      ],
      hasCommunityVoiceReview: true,
      hasConsentDataReview: true,
      hasAccessibilityReview: true,
      hasAuthorityConflictReview: false,
    }
    expect(summarizeNetworkingPlan(draft)).toEqual({
      relationshipCount: 3,
      representedCategoryCount: 3,
      representedEngagementCount: 3,
      nextStepCount: 3,
      draftedAreaCount: 10,
      totalAreaCount: 10,
      safeguardCount: 3,
      totalSafeguardCount: 4,
    })
    expect(buildNetworkingActions(draft).map(({ id }) => id)).toEqual([
      "stage-operating",
      "remaining-reviews",
    ])
    expect(buildNetworkingReviewPrompt(draft)).toContain(
      "Do not invent people, organizations, relationships, authority, consent"
    )
    expect(buildNetworkingReviewPrompt(draft)).toContain(
      "Do not contact, rank, score, endorse, approve, or select anyone"
    )
    expect(buildNetworkingCsv(draft)).toContain(
      '"Relationship label","Category","Engagement","Purpose"'
    )
    expect(
      buildNetworkingCsv({ ...draft, organizationName: "=SUM(A1:A2)" })
    ).toContain("'=SUM(A1:A2)")

    const sanitized = sanitizeNetworkingPlan({
      stage: "unknown",
      objective: "collect-every-contact",
      reviewWeeks: 52,
      networkingPurpose: "a".repeat(900),
      relationships: Array.from({ length: 12 }, (_, index) => ({
        id: `bad id ${index}`,
        label: "b".repeat(300),
        category: "celebrity",
        engagement: "score",
      })),
    })
    expect(sanitized).toMatchObject({
      stage: "exploring",
      objective: "community-listening",
      reviewWeeks: 8,
      networkingPurpose: "a".repeat(700),
    })
    expect(sanitized.relationships).toHaveLength(8)
    expect(sanitized.relationships[0]).toMatchObject({
      id: "badid0",
      label: "b".repeat(160),
      category: "community",
      engagement: "listen",
    })
  })

  it("publishes complete source-backed nonprofit HR guidance", () => {
    expect(HR_ARTICLE.stages.map((stage) => stage.id)).toEqual([
      "exploring",
      "forming",
      "operating",
      "growing",
    ])
    expect(HR_ARTICLE.slug).toBe("tools/hr")
    expect(HR_ARTICLE.framework).toHaveLength(7)
    expect(HR_ARTICLE.checklist.length).toBeGreaterThanOrEqual(12)
    expect(HR_ARTICLE.mistakes.length).toBeGreaterThanOrEqual(8)
    expect(HR_ARTICLE.measures.length).toBeGreaterThanOrEqual(7)
    expect(HR_ARTICLE.sources.length).toBeGreaterThanOrEqual(10)
    expect(HR_ARTICLE.answer).toContain("necessary work")
    expect(HR_ARTICLE.disclaimer).toContain("do not create a job description")
    expect(HR_ARTICLE.sources.map(({ publisher }) => publisher)).toEqual(
      expect.arrayContaining([
        "Coach House",
        "U.S. Department of Labor",
        "Internal Revenue Service",
        "U.S. Equal Employment Opportunity Commission",
        "Occupational Safety and Health Administration",
        "U.S. Citizenship and Immigration Services",
      ])
    )
  })

  it("builds a guarded device-local role and people-practices brief", () => {
    const draft = {
      ...DEFAULT_HR_PLAN,
      organizationName: "Willow Street Family Resource Network",
      roleTitle: "Community Navigation Coordinator",
      stage: "operating" as const,
      relationship: "employee" as const,
      reviewDays: 90 as const,
      missionNeed: "Participants need current navigation and follow-up.",
      roleOutcomes: "Navigation steps and follow-ups are accurate and timely.",
      essentialFunctions: "Appointments, records, referrals, and supervision.",
      qualifications: "Job-related communication and record skills.",
      scheduleLocation: "Twenty-four hours with a published core schedule.",
      compensationResources: "Pay range and full cost require approval.",
      recruitmentAccess: "Accessible opportunity and accommodation contact.",
      selectionProcess:
        "Consistent questions, rubric, and authorized decision.",
      onboardingTraining:
        "Forms, systems, training, contacts, and first review.",
      supervisionFeedback: "Weekly supervision and two-way workload review.",
      accommodationsAccess: "Prompt individualized request and review path.",
      safetyReporting:
        "Training, protected reporting, response, and follow-up.",
      recordsBoundary: "Separated approved systems and role-based access.",
      ownerBackup: "Program director with executive director backup.",
      transitionPlan: "Fair review, access, records, equipment, and handoff.",
      hasClassificationCompensationReview: true,
      hasFairAccessibleProcessReview: true,
      hasSafetyReportingReview: true,
      hasRecordsAuthorityReview: false,
    }
    expect(summarizeHrPlan(draft)).toEqual({
      draftedAreaCount: 15,
      totalAreaCount: 15,
      safeguardCount: 3,
      totalSafeguardCount: 4,
      lifecycleStepCount: 6,
      totalLifecycleStepCount: 6,
    })
    expect(buildHrActions(draft).map(({ id }) => id)).toEqual([
      "stage-operating",
      "remaining-safeguards",
    ])
    expect(buildHrReviewPrompt(draft)).toContain(
      "Do not decide or imply worker classification, exemption, wage"
    )
    expect(buildHrReviewPrompt(draft)).toContain(
      "Do not rank, score, screen, recommend, approve, reject, hire"
    )
    expect(buildHrCsv(draft)).toContain(
      '"Area","Working role and people-practices brief"'
    )
    expect(buildHrCsv({ ...draft, roleTitle: "=SUM(A1:A2)" })).toContain(
      "'=SUM(A1:A2)"
    )

    expect(
      sanitizeHrPlan({
        stage: "unknown",
        relationship: "free-labor",
        reviewDays: 365,
        roleTitle: "r".repeat(200),
        essentialFunctions: "e".repeat(1_100),
        hasSafetyReportingReview: "yes",
      })
    ).toMatchObject({
      stage: "exploring",
      relationship: "employee",
      reviewDays: 90,
      roleTitle: "r".repeat(120),
      essentialFunctions: "e".repeat(900),
      hasSafetyReportingReview: false,
    })
  })

  it("publishes complete source-backed nonprofit finance guidance", () => {
    expect(FINANCE_ARTICLE.stages.map((stage) => stage.id)).toEqual([
      "exploring",
      "forming",
      "operating",
      "growing",
    ])
    expect(FINANCE_ARTICLE.slug).toBe("tools/finance")
    expect(FINANCE_ARTICLE.framework).toHaveLength(7)
    expect(FINANCE_ARTICLE.checklist.length).toBeGreaterThanOrEqual(12)
    expect(FINANCE_ARTICLE.mistakes.length).toBeGreaterThanOrEqual(8)
    expect(FINANCE_ARTICLE.measures.length).toBeGreaterThanOrEqual(8)
    expect(FINANCE_ARTICLE.sources.length).toBeGreaterThanOrEqual(12)
    expect(FINANCE_ARTICLE.answer).toContain("restricted")
    expect(FINANCE_ARTICLE.disclaimer).toContain("do not provide accounting")
    expect(FINANCE_ARTICLE.sources.map(({ publisher }) => publisher)).toEqual(
      expect.arrayContaining([
        "Coach House",
        "Internal Revenue Service",
        "Electronic Code of Federal Regulations",
        "National Council of Nonprofits",
      ])
    )
  })

  it("builds a guarded device-local operating-finance plan", () => {
    const draft = {
      ...DEFAULT_FINANCE_PLAN,
      organizationName: "Willow Street Family Resource Network",
      stage: "operating" as const,
      periodMonths: 12 as const,
      beginningUnrestrictedCash: 48_000,
      beginningRestrictedCash: 72_000,
      plannedUnrestrictedInflows: 164_000,
      plannedRestrictedInflows: 210_000,
      plannedUnrestrictedOutflows: 188_000,
      plannedRestrictedOutflows: 204_000,
      missionCommitments: "Current navigation commitments.",
      fullCostAssumptions: "Direct and shared full costs.",
      revenueEvidence: "Signed, conditional, and forecast sources separated.",
      restrictionTracking: "Source terms traced through remaining balances.",
      cashTiming: "Receipts and payments mapped by date.",
      budgetOwnership: "Staff prepare; board approves.",
      purchaseApproval: "Documented authority and thresholds.",
      paymentReimbursement: "Request, approval, payment, and recording split.",
      bankReconciliation: "Monthly reconciliation and independent review.",
      payrollTaxHandoff: "Provider and internal responsibilities documented.",
      bookkeepingAlignment: "Budget categories map to accounts and programs.",
      reportingRhythm: "Monthly close and quarterly board review.",
      recordsBoundary: "Approved systems and limited access.",
      varianceTriggers: "Material changes return for authorized review.",
      hasApprovedAuthorityReview: true,
      hasRestrictionAwardReview: true,
      hasAccountingPayrollTaxReview: true,
      hasIndependentReconciliationReview: false,
    }
    expect(summarizeFinancePlan(draft)).toEqual({
      totalBeginningCash: 120_000,
      totalPlannedInflows: 374_000,
      totalPlannedOutflows: 392_000,
      projectedUnrestrictedCash: 24_000,
      projectedRestrictedCash: 78_000,
      projectedTotalCash: 102_000,
      averageMonthlyUnrestrictedOutflow: 188_000 / 12,
      unrestrictedCoverageMonths: 24_000 / (188_000 / 12),
      draftedAreaCount: 14,
      totalAreaCount: 14,
      safeguardCount: 3,
      totalSafeguardCount: 4,
      cycleStepCount: 6,
      totalCycleStepCount: 6,
    })
    expect(buildFinanceActions(draft).map(({ id }) => id)).toEqual([
      "stage-operating",
      "remaining-safeguards",
    ])
    expect(buildFinanceReviewPrompt(draft)).toContain(
      "Do not determine accounting treatment, tax, payroll"
    )
    expect(buildFinanceReviewPrompt(draft)).toContain(
      "Do not approve transactions, change the budget, move money"
    )
    expect(buildFinanceCsv(draft)).toContain(
      '"Area","Working nonprofit operating-finance plan"'
    )
    expect(
      buildFinanceCsv({ ...draft, organizationName: "=SUM(A1:A2)" })
    ).toContain("'=SUM(A1:A2)")

    expect(
      sanitizeFinancePlan({
        stage: "unknown",
        periodMonths: 60,
        organizationName: "o".repeat(200),
        missionCommitments: "m".repeat(1_200),
        beginningUnrestrictedCash: -20,
        plannedRestrictedInflows: Number.POSITIVE_INFINITY,
        hasApprovedAuthorityReview: "yes",
      })
    ).toMatchObject({
      stage: "exploring",
      periodMonths: 12,
      organizationName: "o".repeat(120),
      missionCommitments: "m".repeat(900),
      beginningUnrestrictedCash: 0,
      plannedRestrictedInflows: 0,
      hasApprovedAuthorityReview: false,
    })
  })

  it("publishes complete source-backed nonprofit legal guidance", () => {
    expect(LEGAL_ARTICLE.stages.map((stage) => stage.id)).toEqual([
      "exploring",
      "forming",
      "operating",
      "growing",
    ])
    expect(LEGAL_ARTICLE.slug).toBe("tools/legal")
    expect(LEGAL_ARTICLE.framework).toHaveLength(7)
    expect(LEGAL_ARTICLE.checklist.length).toBeGreaterThanOrEqual(12)
    expect(LEGAL_ARTICLE.mistakes.length).toBeGreaterThanOrEqual(8)
    expect(LEGAL_ARTICLE.measures.length).toBeGreaterThanOrEqual(7)
    expect(LEGAL_ARTICLE.sources.length).toBeGreaterThanOrEqual(14)
    expect(LEGAL_ARTICLE.answer).toContain("qualified counsel")
    expect(LEGAL_ARTICLE.importantNote).toContain("immediate danger")
    expect(LEGAL_ARTICLE.disclaimer).toContain("do not provide legal advice")
    expect(LEGAL_ARTICLE.sources.map(({ publisher }) => publisher)).toEqual(
      expect.arrayContaining([
        "Coach House",
        "Internal Revenue Service",
        "U.S. Department of Justice",
        "Federal Trade Commission",
        "American Bar Association",
      ])
    )
  })

  it("builds a guarded device-local legal matter and referral brief", () => {
    const draft = {
      ...DEFAULT_LEGAL_PLAN,
      organizationName: "Willow Street Family Resource Network",
      matterTitle: "Proposed related-party storefront lease",
      stage: "operating" as const,
      category: "property-insurance-risk" as const,
      urgency: "dated-response" as const,
      decisionQuestion: "Whether to enter the proposed lease.",
      knownFacts: "Original proposal and dated communications retained.",
      assumptionsUnknowns: "Local approvals and material terms remain open.",
      affectedPeople: "Participants, workers, directors, and counterparties.",
      jurisdictionsLocations:
        "State, municipal, and federal interfaces mapped.",
      timelineDeadlines: "Received and requested dates copied exactly.",
      governingDocuments: "Current bylaws, delegations, draft, and sources.",
      actionsCommunications: "Signature and announcement paused for review.",
      authorityConflicts:
        "Related party disclosed; disinterested authority mapped.",
      safetyRightsAccess: "Facility, access, privacy, and continuity reviewed.",
      evidencePreservation: "Original records and custodians documented.",
      confidentialityDataBoundary:
        "Minimum necessary records and access defined.",
      counselReferral: "Licensed nonprofit and lease counsel under review.",
      decisionFollowUp:
        "Advice, decision, conditions, owners, and review recorded.",
      hasUrgentSafetyReview: true,
      hasAuthorityConflictReview: true,
      hasJurisdictionSourceReview: true,
      hasQualifiedCounselReview: false,
    }
    expect(summarizeLegalPlan(draft)).toEqual({
      draftedAreaCount: 14,
      totalAreaCount: 14,
      safeguardCount: 3,
      totalSafeguardCount: 4,
      pathwayStepCount: 6,
      totalPathwayStepCount: 6,
    })
    expect(buildLegalActions(draft).map(({ id }) => id)).toEqual([
      "stage-operating",
      "remaining-safeguards",
    ])
    expect(buildLegalReviewPrompt(draft)).toContain(
      "Do not provide legal advice or determine rights"
    )
    expect(buildLegalReviewPrompt(draft)).toContain(
      "Do not suggest deleting, altering, concealing"
    )
    expect(buildLegalCsv(draft)).toContain(
      '"Area","Working nonprofit legal matter and referral brief"'
    )
    expect(buildLegalCsv({ ...draft, matterTitle: "=SUM(A1:A2)" })).toContain(
      "'=SUM(A1:A2)"
    )

    expect(
      sanitizeLegalPlan({
        stage: "unknown",
        category: "general-law",
        urgency: "urgent",
        organizationName: "o".repeat(200),
        knownFacts: "f".repeat(1_200),
        hasQualifiedCounselReview: "yes",
      })
    ).toMatchObject({
      stage: "exploring",
      category: "formation-governance",
      urgency: "planning",
      organizationName: "o".repeat(120),
      knownFacts: "f".repeat(900),
      hasQualifiedCounselReview: false,
    })
  })

  it("publishes complete source-backed nonprofit campaign guidance", () => {
    expect(CAMPAIGNS_ARTICLE.stages.map((stage) => stage.id)).toEqual([
      "exploring",
      "forming",
      "operating",
      "growing",
    ])
    expect(CAMPAIGNS_ARTICLE.slug).toBe("tools/campaigns")
    expect(CAMPAIGNS_ARTICLE.framework).toHaveLength(7)
    expect(CAMPAIGNS_ARTICLE.checklist.length).toBeGreaterThanOrEqual(14)
    expect(CAMPAIGNS_ARTICLE.mistakes.length).toBeGreaterThanOrEqual(8)
    expect(CAMPAIGNS_ARTICLE.measures.length).toBeGreaterThanOrEqual(8)
    expect(CAMPAIGNS_ARTICLE.sources.length).toBeGreaterThanOrEqual(14)
    expect(CAMPAIGNS_ARTICLE.answer).toContain("observable action")
    expect(CAMPAIGNS_ARTICLE.importantNote).toContain("501(c)(3)")
    expect(CAMPAIGNS_ARTICLE.disclaimer).toContain(
      "do not create, approve, publish"
    )
    expect(CAMPAIGNS_ARTICLE.sources.map(({ publisher }) => publisher)).toEqual(
      expect.arrayContaining([
        "Coach House",
        "Centers for Disease Control and Prevention",
        "Internal Revenue Service",
        "Federal Trade Commission",
        "Federal Communications Commission",
        "U.S. Department of Justice",
        "World Wide Web Consortium",
      ])
    )
  })

  it("builds a guarded device-local nonprofit campaign brief", () => {
    const draft = {
      ...DEFAULT_CAMPAIGN_PLAN,
      organizationName: "Willow Street Family Resource Network",
      campaignName: "Appointments without the guesswork",
      stage: "operating" as const,
      campaignType: "service-access" as const,
      startDate: "2026-10-05",
      endDate: "2026-11-15",
      objective: "Support a service-access decision.",
      primaryAudience: "Defined residents in three ZIP codes.",
      audienceEvidence: "Listening and program evidence with limits.",
      desiredAction: "Use the reviewed request path.",
      mainMessage: "Appointments are free and language support is available.",
      supportingEvidence: "Current program sources and claim limits.",
      offerDestination: "Reviewed mobile service page and phone option.",
      channelRoles: "Distinct partner, email, social, print, and event roles.",
      timelineMilestones: "Review, test, launch, live checks, and closeout.",
      budgetCapacity: "Authorized cost, service threshold, and pause rule.",
      ownersApprovals: "Named source, access, spending, and response owners.",
      accessibilityLanguage: "Reviewed language and disability access paths.",
      consentPrivacy: "Permission, list source, opt-out, and data limits.",
      complianceReview: "Current tax, legal, funding, and channel review.",
      responseEscalation: "Routine, private, correction, and pause paths.",
      measurementPlan: "Delivery, actions, access, cost, and limits.",
      learningDecision: "Record a maintain, revise, pause, or stop decision.",
      hasClaimReview: true,
      hasAccessibilityReview: true,
      hasConsentPrivacyReview: true,
      hasLegalChannelReview: true,
      hasDeliveryCapacityReview: true,
    }
    expect(summarizeCampaignPlan(draft)).toEqual({
      draftedAreaCount: 17,
      totalAreaCount: 17,
      pathwayStepCount: 7,
      totalPathwayStepCount: 7,
      safeguardCount: 5,
      totalSafeguardCount: 5,
      durationDays: 42,
    })
    expect(buildCampaignActions(draft).map(({ id }) => id)).toEqual([
      "stage-operating",
    ])
    expect(buildCampaignReviewPrompt(draft)).toContain(
      "Do not publish, send, target"
    )
    expect(buildCampaignReviewPrompt(draft)).toContain(
      "Do not invent audience research"
    )
    expect(buildCampaignCsv(draft)).toContain(
      '"Area","Working nonprofit campaign brief"'
    )
    expect(
      buildCampaignCsv({ ...draft, campaignName: "=SUM(A1:A2)" })
    ).toContain("'=SUM(A1:A2)")

    expect(
      sanitizeCampaignPlan({
        stage: "unknown",
        campaignType: "viral",
        organizationName: "o".repeat(200),
        audienceEvidence: "e".repeat(1_200),
        startDate: "tomorrow",
        hasClaimReview: "yes",
      })
    ).toMatchObject({
      stage: "exploring",
      campaignType: "awareness-education",
      organizationName: "o".repeat(120),
      audienceEvidence: "e".repeat(900),
      startDate: "",
      hasClaimReview: false,
    })
  })

  it("publishes complete source-backed nonprofit CRM guidance", () => {
    expect(CRM_ARTICLE.stages.map((stage) => stage.id)).toEqual([
      "exploring",
      "forming",
      "operating",
      "growing",
    ])
    expect(CRM_ARTICLE.slug).toBe("tools/crm")
    expect(CRM_ARTICLE.framework).toHaveLength(7)
    expect(CRM_ARTICLE.checklist.length).toBeGreaterThanOrEqual(15)
    expect(CRM_ARTICLE.mistakes.length).toBeGreaterThanOrEqual(8)
    expect(CRM_ARTICLE.measures.length).toBeGreaterThanOrEqual(8)
    expect(CRM_ARTICLE.sources.length).toBeGreaterThanOrEqual(14)
    expect(CRM_ARTICLE.answer).toContain("governed relationship record")
    expect(CRM_ARTICLE.importantNote).toContain("HIPAA and FERPA")
    expect(CRM_ARTICLE.disclaimer).toContain("do not collect, import, identify")
    expect(CRM_ARTICLE.sources.map(({ publisher }) => publisher)).toEqual(
      expect.arrayContaining([
        "Coach House",
        "Federal Trade Commission",
        "National Institute of Standards and Technology",
        "Cybersecurity and Infrastructure Security Agency",
        "Internal Revenue Service",
        "Federal Communications Commission",
        "U.S. Department of Health and Human Services",
        "U.S. Department of Education",
        "U.S. Department of Justice",
        "World Wide Web Consortium",
        "USAGov",
      ])
    )
  })

  it("builds a guarded device-local CRM field and stewardship plan", () => {
    const draft = {
      ...DEFAULT_CRM_PLAN,
      organizationName: "Willow Street Family Resource Network",
      planName: "Shared relationship record pilot",
      stage: "forming" as const,
      relationshipContext: "mixed" as const,
      reviewMonths: 3 as const,
      systemPurpose: "Support named relationship decisions.",
      peopleAndDecisions: "Affected people and accountable owners review it.",
      recordBoundary: "Keep protected case details in another system.",
      collectionNoticeConsent: "Record source, notice, and permission review.",
      communicationPreferences: "Honor channel choices and suppressions.",
      identityDeduplication: "Use a stable ID and human duplicate review.",
      relationshipLifecycle: "Use neutral stages and dated next actions.",
      accessRoles: "Give named roles minimum access.",
      dataQualityCorrection: "Route corrections and stale records to owners.",
      retentionDeletion: "Review preservation, retention, and deletion.",
      integrationsExports: "Inventory fields, flows, owners, and exit paths.",
      securityIncident: "Use strong access and a tested incident path.",
      accessibilityLanguage: "Offer accessible and language-aware choices.",
      reportingDecision: "Use process evidence for named decisions.",
      vendorMigration: "Test with fictional records and reconcile migration.",
      fields: [
        {
          id: "contact-preference",
          label: "Contact preference status",
          category: "contact-preference" as const,
          purpose: "Honor a current channel choice.",
          source: "Direct instruction with date and source.",
          sensitivity: "restricted" as const,
          accessRole: "Communication operators",
          retentionReview: "Review when purpose or systems change.",
        },
        {
          id: "access-support",
          label: "Access support requested",
          category: "program-service" as const,
          purpose: "Route a current access request.",
          source: "Voluntary direct request.",
          sensitivity: "high-risk" as const,
          accessRole: "Program access coordinator",
          retentionReview: "Review after fulfillment.",
        },
      ],
      hasMinimumNecessaryReview: true,
      hasNoticePreferenceReview: true,
      hasAccessIntegrationReview: true,
      hasRetentionIncidentReview: true,
      hasLegalSectorReview: true,
    }

    expect(summarizeCrmPlan(draft)).toEqual({
      draftedAreaCount: 15,
      totalAreaCount: 15,
      lifecycleStepCount: 7,
      totalLifecycleStepCount: 7,
      safeguardCount: 5,
      totalSafeguardCount: 5,
      fieldCount: 2,
      completeFieldCount: 2,
      representedCategoryCount: 2,
      highRiskFieldCount: 1,
    })
    expect(buildCrmActions(draft).map(({ id }) => id)).toEqual([
      "stage-forming",
    ])
    expect(buildCrmReviewPrompt(draft)).toContain(
      "Do not import, identify, enrich"
    )
    expect(buildCrmReviewPrompt(draft)).toContain(
      "Remove all real names, contact details"
    )
    expect(buildCrmCsv(draft)).toContain(
      '"Record","Label","Category","Purpose or value"'
    )
    expect(buildCrmCsv({ ...draft, planName: "=SUM(A1:A2)" })).toContain(
      "'=SUM(A1:A2)"
    )

    expect(
      sanitizeCrmPlan({
        stage: "unknown",
        relationshipContext: "sales",
        reviewMonths: 24,
        organizationName: "o".repeat(200),
        systemPurpose: "p".repeat(1_200),
        fields: Array.from({ length: 20 }, (_, index) => ({
          id: `field ${index}`,
          label: `Field ${index}`,
          category: "secret",
          sensitivity: "critical",
        })),
        hasMinimumNecessaryReview: "yes",
      })
    ).toMatchObject({
      stage: "exploring",
      relationshipContext: "fundraising",
      reviewMonths: 6,
      organizationName: "o".repeat(120),
      systemPurpose: "p".repeat(800),
      hasMinimumNecessaryReview: false,
      fields: expect.arrayContaining([
        expect.objectContaining({
          id: "field0",
          category: "identity",
          sensitivity: "standard",
        }),
      ]),
    })
    expect(
      sanitizeCrmPlan({
        fields: Array.from({ length: 20 }, (_, index) => ({
          label: `Field ${index}`,
        })),
      }).fields
    ).toHaveLength(8)
  })

  it("uses the shared public and authenticated canvas shells", () => {
    const layout = readSource("src/app/(public)/documentation/layout.tsx")
    const shell = readSource(
      "src/features/nonprofit-documentation/components/documentation-shell.tsx"
    )
    const appShellTypes = readSource("src/components/app-shell/types.ts")

    expect(layout).toContain("resolveDashboardLayoutState")
    expect(layout).toContain("readAppSidebarDefaultOpen")
    expect(layout).toContain("shellState.userPresent ? shellState : null")
    expect(shell).toContain("HomeCanvasFindShell")
    expect(shell).toContain("<AppShell")
    expect(shell).toContain("<DocumentationRail contextual />")
    expect(shell).toContain("allowOnboardingLockedContent")
    expect(appShellTypes).toContain("contextualNavigation?: ReactNode")
  })

  it("keeps route files composition-only and exposes crawlable metadata", () => {
    const homeRoute = readSource("src/app/(public)/documentation/page.tsx")
    const missionRoute = readSource(
      "src/app/(public)/documentation/best-practices/mission/page.tsx"
    )
    const complianceRoute = readSource(
      "src/app/(public)/documentation/best-practices/compliance/page.tsx"
    )
    const fundraisingRoute = readSource(
      "src/app/(public)/documentation/best-practices/fundraising/page.tsx"
    )
    const marketingRoute = readSource(
      "src/app/(public)/documentation/best-practices/marketing/page.tsx"
    )
    const frameworksRoute = readSource(
      "src/app/(public)/documentation/best-practices/frameworks/page.tsx"
    )
    const measuringImpactRoute = readSource(
      "src/app/(public)/documentation/best-practices/measuring-impact/page.tsx"
    )
    const sustainabilityRoute = readSource(
      "src/app/(public)/documentation/best-practices/sustainability/page.tsx"
    )
    const partnershipsRoute = readSource(
      "src/app/(public)/documentation/best-practices/partnerships/page.tsx"
    )
    const socialMediaRoute = readSource(
      "src/app/(public)/documentation/tools/social-media/page.tsx"
    )
    const networkingRoute = readSource(
      "src/app/(public)/documentation/tools/networking/page.tsx"
    )
    const hrRoute = readSource(
      "src/app/(public)/documentation/tools/hr/page.tsx"
    )
    const financeRoute = readSource(
      "src/app/(public)/documentation/tools/finance/page.tsx"
    )
    const legalRoute = readSource(
      "src/app/(public)/documentation/tools/legal/page.tsx"
    )
    const campaignsRoute = readSource(
      "src/app/(public)/documentation/tools/campaigns/page.tsx"
    )
    const crmRoute = readSource(
      "src/app/(public)/documentation/tools/crm/page.tsx"
    )
    const marketplaceRoute = readSource(
      "src/app/(public)/documentation/marketplace/page.tsx"
    )
    const marketplacePage = readSource(
      "src/features/nonprofit-documentation/components/marketplace-page.tsx"
    )
    const marketplaceData = readSource(
      "src/features/nonprofit-documentation/lib/marketplace-resources.ts"
    )
    const quickstartRoute = readSource(
      "src/app/(public)/documentation/quickstart/page.tsx"
    )
    const conceptsRoute = readSource(
      "src/app/(public)/documentation/key-concepts/page.tsx"
    )
    const home = readSource(
      "src/features/nonprofit-documentation/components/documentation-home.tsx"
    )
    const mission = readSource(
      "src/features/nonprofit-documentation/components/mission-article.tsx"
    )
    const article = readSource(
      "src/features/nonprofit-documentation/components/best-practice-article.tsx"
    )

    expect(homeRoute).toContain("<DocumentationHome />")
    expect(missionRoute).toContain("<MissionArticlePage />")
    expect(complianceRoute).toContain("<ComplianceArticlePage />")
    expect(fundraisingRoute).toContain("<FundraisingArticlePage />")
    expect(fundraisingRoute).toContain(
      'canonical: "/documentation/best-practices/fundraising"'
    )
    expect(marketingRoute).toContain("<MarketingArticlePage />")
    expect(marketingRoute).toContain(
      'canonical: "/documentation/best-practices/marketing"'
    )
    expect(frameworksRoute).toContain("<FrameworksArticlePage />")
    expect(frameworksRoute).toContain(
      'canonical: "/documentation/best-practices/frameworks"'
    )
    expect(measuringImpactRoute).toContain("<MeasuringImpactArticlePage />")
    expect(measuringImpactRoute).toContain(
      'canonical: "/documentation/best-practices/measuring-impact"'
    )
    expect(sustainabilityRoute).toContain("<SustainabilityArticlePage />")
    expect(sustainabilityRoute).toContain(
      'canonical: "/documentation/best-practices/sustainability"'
    )
    expect(partnershipsRoute).toContain("<PartnershipsArticlePage />")
    expect(partnershipsRoute).toContain(
      'canonical: "/documentation/best-practices/partnerships"'
    )
    expect(socialMediaRoute).toContain("<SocialMediaArticlePage />")
    expect(socialMediaRoute).toContain(
      'canonical: "/documentation/tools/social-media"'
    )
    expect(networkingRoute).toContain("<NetworkingArticlePage />")
    expect(networkingRoute).toContain(
      'canonical: "/documentation/tools/networking"'
    )
    expect(hrRoute).toContain("<HrArticlePage />")
    expect(hrRoute).toContain('canonical: "/documentation/tools/hr"')
    expect(financeRoute).toContain("<FinanceArticlePage />")
    expect(financeRoute).toContain('canonical: "/documentation/tools/finance"')
    expect(legalRoute).toContain("<LegalArticlePage />")
    expect(legalRoute).toContain('canonical: "/documentation/tools/legal"')
    expect(campaignsRoute).toContain("<CampaignsArticlePage />")
    expect(campaignsRoute).toContain(
      'canonical: "/documentation/tools/campaigns"'
    )
    expect(crmRoute).toContain("<CrmArticlePage />")
    expect(crmRoute).toContain('canonical: "/documentation/tools/crm"')
    expect(crmRoute).not.toContain("ensureUser")
    expect(marketplaceRoute).toContain("<MarketplacePage")
    expect(marketplaceRoute).toContain(
      'canonical: "/documentation/marketplace"'
    )
    expect(marketplaceRoute).not.toContain("ensureUser")
    expect(marketplacePage).toContain('"@type": "CollectionPage"')
    expect(marketplacePage).toContain('"@type": "ItemList"')
    expect(marketplacePage).toContain('"@type": "BreadcrumbList"')
    expect(marketplacePage).toContain("<MarketplacePeople")
    expect(marketplaceRoute).toContain("fetchPublicPeopleDirectory")
    expect(marketplaceData).not.toContain("listCoachingCoaches")
    expect(marketplaceData).not.toContain("coaching_coaches")
    expect(quickstartRoute).toContain(
      "<FoundationGuidePage guide={QUICKSTART_GUIDE} />"
    )
    expect(conceptsRoute).toContain(
      "<FoundationGuidePage guide={KEY_CONCEPTS_GUIDE} />"
    )
    expect(missionRoute).toContain(
      'canonical: "/documentation/best-practices/mission"'
    )
    expect(home).toContain('"@type": "CollectionPage"')
    expect(mission).toContain("<BestPracticeArticlePage")
    expect(article).toContain('"@type": "Article"')
    expect(article).toContain('"@type": "BreadcrumbList"')
    expect(quickstartRoute).toContain('canonical: "/documentation/quickstart"')
    expect(conceptsRoute).toContain('canonical: "/documentation/key-concepts"')
    expect(complianceRoute).toContain(
      'canonical: "/documentation/best-practices/compliance"'
    )
  })
})
