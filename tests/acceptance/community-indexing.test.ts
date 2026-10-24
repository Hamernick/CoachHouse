import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const context = vi.hoisted(() => ({
  publicSharingEnabled: false,
  requireSession: vi.fn(),
  resolveContext: vi.fn(),
}))

vi.mock("@/lib/feature-flags", () => ({
  get publicSharingEnabled() { return context.publicSharingEnabled },
}))
vi.mock("@/lib/queries/public-profile-sitemap", () => ({
  fetchPublishedPublicHandles: vi.fn(async () => [
    { handle: "published-profile", updatedAt: "2026-10-13T00:00:00Z" },
  ]),
}))
vi.mock("@/features/nonprofit-documentation", () => ({
  documentationSitemapEntries: () => [{ url: "https://coachhouse.app/documentation" }],
}))
vi.mock("@/lib/auth", () => ({ requireServerSession: context.requireSession }))
vi.mock("@/lib/auth/request-context", () => ({
  resolveOptionalAuthenticatedAppContext: context.resolveContext,
}))
vi.mock("@/components/community/community-join-cards", () => ({
  CommunityJoinCards: () => null,
}))

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://coachhouse.app")
  context.publicSharingEnabled = false
  context.resolveContext.mockResolvedValue(null)
})
afterEach(() => vi.unstubAllEnvs())

describe("community search visibility follows its public-access gate", () => {
  it.each([false, true])("keeps sitemap and robots consistent when public sharing is %s", async (enabled) => {
    context.publicSharingEnabled = enabled
    const { default: sitemap } = await import("@/app/sitemap")
    const { metadata } = await import("@/app/(community)/community/page")
    const urls = (await sitemap()).map(({ url }) => url)

    expect(urls.includes("https://coachhouse.app/community")).toBe(enabled)
    expect(metadata.robots).toEqual({ index: enabled, follow: true })
    expect(metadata.title).toBe("Community")
    expect(urls).toContain("https://coachhouse.app/resources")
    expect(urls).not.toContain("https://coachhouse.app/published-profile") // Profiles live in paginated sitemaps.
    expect(urls).toContain("https://coachhouse.app/documentation")
  })

  it("preserves the anonymous login gate while the route is not indexable", async () => {
    context.requireSession.mockRejectedValueOnce(new Error("login required"))
    const { default: CommunityPage } = await import("@/app/(community)/community/page")
    await expect(CommunityPage()).rejects.toThrow("login required")
    expect(context.requireSession).toHaveBeenCalledWith("/community")
  })
})
