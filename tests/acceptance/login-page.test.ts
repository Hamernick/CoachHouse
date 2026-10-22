import { beforeEach, describe, expect, it, vi } from "vitest"

import { captureRedirect, createSupabaseServerClientServerMock, resetTestMocks } from "./test-utils"
import { getSafePostLoginRedirectPath } from "@/lib/auth/redirects"

vi.mock("@/components/auth/login-panel", () => ({ LoginPanel: () => null }))
vi.mock("@/components/auth/auth-screen-shell", () => ({ AuthScreenShell: () => null }))

function session(signedIn = false) {
  createSupabaseServerClientServerMock.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: signedIn ? { id: "user-1" } : null }, error: null }) },
  })
}

describe("canonical login page", () => {
  beforeEach(() => { resetTestMocks(); session() })

  it("renders the established form directly without a prototype redirect", async () => {
    const { default: LoginPage } = await import("@/app/(auth)/login/page")
    const page = await LoginPage({})
    expect(page.props.showBrand).toBe(true)
    expect(page.props.children.props.redirectTo).toBe("/workspace")
    expect(page.props.children.props.signUpHref).toBe("/sign-up?redirect=%2Fworkspace")
  })

  it("preserves invitation destinations, errors and plan choices", async () => {
    const { default: LoginPage } = await import("@/app/(auth)/login/page")
    const destination = "/join-organization?token=fixture-invite"
    const page = await LoginPage({ searchParams: Promise.resolve({ redirect: destination, error: "Try again", notice: "email_confirmed_sign_in", plan: "organization", addon: "accelerator" }) })
    expect(page.props.children.props.redirectTo).toBe(destination)
    expect(page.props.children.props.initialError).toBe("Try again")
    const signup = new URL(page.props.children.props.signUpHref, "https://example.org")
    expect(signup.searchParams.get("redirect")).toBe(destination)
    expect(signup.searchParams.get("plan")).toBe("organization")
    expect(signup.searchParams.get("addon")).toBe("accelerator")
  })

  it.each(["/workspace", "/join-organization?token=fixture-invite"])("sends authenticated visitors to %s", async (destination) => {
    session(true)
    const { default: LoginPage } = await import("@/app/(auth)/login/page")
    expect(await captureRedirect(() => LoginPage({ searchParams: Promise.resolve({ redirect: destination }) }))).toBe(destination)
  })

  it.each(["https://example.org", "//example.org", "/login", "/login/?error=expired", "/tester/login?redirect=/workspace", "/home-canvas?section=login"])("prevents unsafe or looping return destination %s", async (destination) => {
    expect(getSafePostLoginRedirectPath(destination)).toBeUndefined()
    session(true)
    const { default: LoginPage } = await import("@/app/(auth)/login/page")
    expect(await captureRedirect(() => LoginPage({ searchParams: Promise.resolve({ redirect: destination }) }))).toBe("/workspace")
  })
})
