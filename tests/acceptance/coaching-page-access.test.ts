import { beforeEach, describe, expect, it, vi } from "vitest"

import { CoachingBookingPage } from "@/features/coaching-booking/components/coaching-booking-page"

const { context, loadPage, confirmCheckout } = vi.hoisted(() => ({
  context: vi.fn(),
  loadPage: vi.fn(),
  confirmCheckout: vi.fn(),
}))

vi.mock("@/lib/auth/request-context", () => ({
  resolveOptionalAuthenticatedAppContext: context,
}))
vi.mock("@/features/coaching-booking/loaders", () => ({
  loadCoachingBookingPageData: loadPage,
  confirmPaidCoachingCheckoutReturn: confirmCheckout,
  cancelPendingCoachingCheckoutReturn: vi.fn(),
}))
vi.mock("@/features/coaching-booking/components/coaching-booking-flow", () => ({
  CoachingBookingFlow: () => null,
}))

describe("coaching page account access", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    loadPage.mockResolvedValue({})
  })

  it.each([undefined, {}, { coaching_access: false }, { coaching_access: "true" }])(
    "blocks coaches without a valid app metadata grant: %j", async (appMetadata) => {
      context.mockResolvedValue({
        user: { id: "coach", app_metadata: appMetadata, user_metadata: { coaching_access: true } },
        profileAudience: { platformAccessLevel: "coach" },
      })
      await expect(CoachingBookingPage({ searchParams: { checkout: "success", booking: "booking" } }))
        .rejects.toThrow("redirect:/organizations")
      expect(loadPage).not.toHaveBeenCalled()
      expect(confirmCheckout).not.toHaveBeenCalled()
    }
  )

  it.each(["coach", "developer", null])("loads coaching for granted coaches and existing %s access", async (accessLevel) => {
    context.mockResolvedValue({
      supabase: {}, activeOrg: { orgId: "org" },
      user: { id: "user", email: "user@example.test", app_metadata: accessLevel === "coach" ? { coaching_access: true } : {} },
      profileAudience: { platformAccessLevel: accessLevel },
    })
    await CoachingBookingPage()
    expect(loadPage).toHaveBeenCalledWith({
      supabase: {}, orgId: "org", userId: "user", userEmail: "user@example.test",
    })
  })

  it("shows generic recovery guidance for an unavailable query without promising a credit", async () => {
    context.mockResolvedValue({
      supabase: {}, activeOrg: { orgId: "org" },
      user: { id: "user", email: "user@example.test", app_metadata: {} },
      profileAudience: { platformAccessLevel: null },
    })
    const page = await CoachingBookingPage({ searchParams: { checkout: "unavailable" } })
    expect(page.props.bookingNotice).toBe("That time is no longer available. Choose another time.")
    expect(page.props.bookingNotice).not.toContain("credit")
    expect(confirmCheckout).not.toHaveBeenCalled()
  })

  it("requires sign-in", async () => {
    context.mockResolvedValue(null)
    await expect(CoachingBookingPage()).rejects.toThrow("redirect:/login?redirect=/coaching")
    expect(loadPage).not.toHaveBeenCalled()
  })
})
