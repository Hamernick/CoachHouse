import { beforeEach, describe, expect, it, vi } from "vitest"
import { captureRedirect, createSupabaseServerClientServerMock, redirectMock, resetTestMocks } from "./test-utils"

vi.mock("next/navigation", () => ({ redirect: redirectMock, permanentRedirect: redirectMock }))

describe("retired public page destinations", () => {
  beforeEach(() => resetTestMocks())

  it.each([
    [{}, "/"],
    [{ section: "hero" }, "/"],
    [{ section: "login" }, "/login"],
    [{ section: "signup", intent: "build" }, "/sign-up?intent=build"],
    [{ section: "pricing", embed: "1", source: "campaign", plan: "organization" }, "/pricing?source=campaign&plan=organization"],
    [{ section: "login", redirect: "/join-organization?token=fixture", notice: "email_confirmed_sign_in" }, "/login?redirect=%2Fjoin-organization%3Ftoken%3Dfixture&notice=email_confirmed_sign_in"],
    [{ section: "login", code: "fixture-code", redirect: "/workspace" }, "/auth/callback?section=login&code=fixture-code&redirect=%2Fworkspace"],
    [{ token_hash: "fixture-hash", type: "recovery", next: "/update-password" }, "/auth/callback?token_hash=fixture-hash&type=recovery&next=%2Fupdate-password"],
    [{ section: "pricing", tag: ["one", "two"] }, "/pricing?tag=one&tag=two"],
  ])("preserves the destination for %j", async (params, expected) => {
    const { default: Page } = await import("@/app/(public)/home-canvas/page")
    expect(await captureRedirect(() => Page({ searchParams: Promise.resolve(params) }))).toBe(expected)
    expect(createSupabaseServerClientServerMock).not.toHaveBeenCalled()
  })

  it("preserves tester return paths and notices through canonical login", async () => {
    const { default: Page } = await import("@/app/(auth)/tester/login/page")
    expect(await captureRedirect(() => Page({ searchParams: Promise.resolve({ redirect: "/workspace", notice: "email_confirmed_sign_in" }) }))).toBe("/login?redirect=%2Fworkspace&notice=email_confirmed_sign_in")
  })

  it("redirects old homepage prototypes to the current homepage", async () => {
    const { default: Home } = await import("@/app/(public)/home/page")
    const { default: Legacy } = await import("@/app/(public)/legacy-home/page")
    expect(await captureRedirect(async () => Home())).toBe("/")
    expect(await captureRedirect(async () => Legacy())).toBe("/")
  })

  it("moves marketplace bookmarks to Documentation with supported filters", async () => {
    const { default: Page } = await import("@/app/(dashboard)/marketplace/page")
    expect(await captureRedirect(() => Page({ searchParams: Promise.resolve({ q: "Canva", type: "software", category: "top-picks" }) }))).toBe("/documentation/marketplace?q=Canva&type=software")
  })
})
