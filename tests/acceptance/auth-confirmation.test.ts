import "./test-utils"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { captureRedirect, createSupabaseServerClientServerMock, headersMock } from "./test-utils"

import { buildSupabaseAuthEmailPreviews } from "@/features/organization-access"
import { homeCollectionReturnHref } from "@/features/build-collect-navigation/lib/home-resource-preview"
import { buildPostSignupBuilderRedirect } from "@/lib/onboarding/signup-plan"
import {
  buildLoginUrlWithAuthConfirmationError,
  getSafeEmailOtpType,
  resolvePostAuthConfirmationRedirect,
  resolveAuthConfirmationDestination,
  resolveConfirmedSignupDestination,
} from "@/lib/supabase/auth-confirmation"

describe("auth confirmation", () => {
  it("preserves an organization invitation through the actual confirmation form action", async () => {
    const destination = "/join-organization?token=sample-invite"
    const callback = `https://coachhouse.app/auth/callback?redirect=${encodeURIComponent(destination)}`
    headersMock.mockResolvedValue({ get: (name: string) => name === "host" ? "coachhouse.app" : undefined })
    createSupabaseServerClientServerMock.mockResolvedValue({ auth: { verifyOtp: vi.fn().mockResolvedValue({
      data: { user: { user_metadata: { onboarding_intent_focus: "support" } } }, error: null,
    }) } })
    const { default: ConfirmEmailPage } = await import("@/app/auth/confirm/page")
    const page = await ConfirmEmailPage({ searchParams: Promise.resolve({ token_hash: "test-token", type: "email", next: callback }) })
    const form = page.props.children.props.children
    const formData = new FormData()
    for (const input of form.props.children.filter((child: { type: string }) => child.type === "input")) {
      formData.set(input.props.name, input.props.value)
    }
    expect(await captureRedirect(() => form.props.action(formData))).toBe(`https://coachhouse.app${destination}`)
  })

  it.each(["relative", "absolute", "callback"])("preserves the homepage collection through %s human confirmation", async (format) => {
    const returnHref = homeCollectionReturnHref({ id: "resource-1", kind: "resource", query: "food help", createdAt: 1 }, "food help")
    const next = format === "relative" ? returnHref : format === "absolute"
      ? `https://coachhouse.app${returnHref}`
      : `https://coachhouse.app/auth/callback?redirect=${encodeURIComponent(returnHref)}`
    const expected = format === "relative" ? returnHref : `https://coachhouse.app${returnHref}`
    headersMock.mockResolvedValue({ get: (name: string) => name === "host" ? "coachhouse.app" : undefined })
    createSupabaseServerClientServerMock.mockResolvedValue({ auth: { verifyOtp: vi.fn().mockResolvedValue({
      data: { user: { user_metadata: { onboarding_intent_focus: "build", onboarding_selected_builder_plan_tier: "organization" } } }, error: null,
    }) } })
    const { default: ConfirmEmailPage } = await import("@/app/auth/confirm/page")
    const page = await ConfirmEmailPage({ searchParams: Promise.resolve({ token_hash: "test-token", type: "email", next }) })
    const form = page.props.children.props.children
    const formData = new FormData()
    for (const input of form.props.children.filter((child: { type: string }) => child.type === "input")) {
      formData.set(input.props.name, input.props.value)
    }
    expect(await captureRedirect(() => form.props.action(formData))).toBe(expected)
  })

  it.each(["/?homeSearch=food", "/#home-resource-preview", "https://coachhouse.app/?homeSearch=food", "https://coachhouse.app/#home-resource-preview"])("preserves explicit root state in %s", (destination) => {
    const safe = resolveAuthConfirmationDestination(destination)
    expect(safe).toBe(destination)
    expect(resolveConfirmedSignupDestination({ destination: safe, type: "signup" })).toBe(destination)
    if (destination.startsWith("https:")) {
      const login = new URL(resolvePostAuthConfirmationRedirect(destination, "https://legacy-confirm-host.example"))
      const original = new URL(destination)
      expect(login.searchParams.get("redirect")).toBe(`${original.pathname}${original.search}${original.hash}`)
    }
  })

  it.each(["free", "organization", "operations_support"] as const)("preserves every %s checkout/onboarding parameter through the email link", (planTier) => {
    const destination = buildPostSignupBuilderRedirect({ planTier, source: "signup" })
    const callback = `https://coachhouse.app/auth/callback?redirect=${encodeURIComponent(destination)}`
    const template = buildSupabaseAuthEmailPreviews("https://coachhouse.app").find((item) => item.id === "supabase-confirm-sign-up")!.html
    // Supabase renders with Go html/template, which escapes query-context values.
    // Model that encoding here rather than raw text substitution into the URL.
    const html = template
      .replaceAll("{{ .TokenHash }}", "test-token")
      .replaceAll("{{ .RedirectTo }}", encodeURIComponent(callback))
    const href = html.match(/href="([^"]*\/auth\/confirm[^"]*)"/)![1].replaceAll("&amp;", "&")
    const emailLink = new URL(href)
    expect(resolveAuthConfirmationDestination(emailLink.searchParams.get("next"), "https://coachhouse.app"))
      .toBe(`https://coachhouse.app${destination}`)
  })

  it.each([
    { plan: null, otpError: false },
    { plan: "free", otpError: false },
    { plan: "organization", otpError: false },
    { plan: "operations_support", otpError: false },
    { plan: "organization", otpError: true },
  ])("only resumes $plan after successful human confirmation (OTP error: $otpError)", async ({ plan, otpError }) => {
    headersMock.mockResolvedValue({ get: (name: string) => name === "host" ? "coachhouse.app" : undefined })
    const verifyOtp = vi.fn().mockResolvedValue({
      data: { user: { user_metadata: { onboarding_intent_focus: "build", onboarding_selected_builder_plan_tier: plan } } },
      error: otpError ? { message: "Expired token" } : null,
    })
    createSupabaseServerClientServerMock.mockResolvedValue({ auth: { verifyOtp } })
    const { default: ConfirmEmailPage } = await import("@/app/auth/confirm/page")
    const page = await ConfirmEmailPage({ searchParams: Promise.resolve({ token_hash: "test-token", type: "email", next: "https://coachhouse.app" }) })
    const form = page.props.children.props.children
    expect(form.type).toBe("form")
    expect(verifyOtp).not.toHaveBeenCalled()
    const formData = new FormData()
    for (const input of form.props.children.filter((child: { type: string }) => child.type === "input")) {
      formData.set(input.props.name, input.props.value)
    }
    const result = new URL(await captureRedirect(() => form.props.action(formData)), "https://coachhouse.app")
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "test-token", type: "email" })
    expect(result.pathname).toBe(otpError ? "/login" : plan === null || plan === "free" ? "/onboarding" : "/api/stripe/checkout")
    if (otpError) expect(result.searchParams.get("error")).toContain("invalid or expired")
    else expect(result.searchParams.get("plan")).toBe(plan)
  })

  it.each(["organization", "operations_support", "free"])("recovers the %s signup when the provider replaces the callback with its Site URL", (plan) => {
    const destination = resolveAuthConfirmationDestination("https://coachhouse.app", "https://coachhouse.app")
    const result = new URL(resolveConfirmedSignupDestination({
      destination,
      type: "email",
      userMetadata: { onboarding_intent_focus: "build", onboarding_selected_builder_plan_tier: plan },
    }))
    expect(result.origin).toBe("https://coachhouse.app")
    expect(result.pathname).toBe(plan === "free" ? "/onboarding" : "/api/stripe/checkout")
    expect(result.searchParams.get("plan")).toBe(plan)
    if (plan !== "free") {
      expect(result.searchParams.get("redirect")).toBe("/onboarding?source=onboarding_pricing")
      expect(result.searchParams.get("context")).toBe("onboarding_builder")
    }
  })

  it("recovers missing signup destinations without replacing explicit application or recovery destinations", () => {
    expect(resolveConfirmedSignupDestination({ destination: "/workspace", type: "signup" })).toBe("/onboarding?source=signup")
    for (const destination of ["/documentation/fiscal-sponsorship#application", "/find", "/onboarding?source=signup"]) {
      expect(resolveConfirmedSignupDestination({ destination, type: "email" })).toBe(destination)
    }
    expect(resolveConfirmedSignupDestination({ destination: "/", type: "recovery" })).toBe("/")
    expect(resolveConfirmedSignupDestination({ destination: "/", type: "email", userMetadata: { onboarding_completed: true } })).toBe("/")
  })

  it("routes signup confirmation emails through the human-confirm page", () => {
    const preview = buildSupabaseAuthEmailPreviews("https://coachhouse.app").find(
      (item) => item.id === "supabase-confirm-sign-up",
    )

    expect(preview?.html).toContain(
      "https://coachhouse.app/auth/confirm?token_hash={{ .TokenHash }}",
    )
    expect(preview?.html).toContain("type=email")
    expect(preview?.html).toContain("next={{ .RedirectTo }}")
    expect(preview?.html).not.toContain("{{ .ConfirmationURL }}")
  })

  it("unwraps the legacy callback redirect into the real post-confirmation path", () => {
    expect(
      resolveAuthConfirmationDestination(
        "https://coachhouse.app/auth/callback?redirect=%2Fonboarding%3Fsource%3Dhome_signup",
        "https://coachhouse.app",
      ),
    ).toBe("https://coachhouse.app/onboarding?source=home_signup")

    expect(
      resolveAuthConfirmationDestination(
        "/auth/callback?redirect=%2Fonboarding%3Fsource%3Dhome_signup",
        "https://coachhouse.app",
      ),
    ).toBe("/onboarding?source=home_signup")
  })

  it("rejects external or unsafe confirmation destinations", () => {
    expect(
      resolveAuthConfirmationDestination(
        "https://coachhouse.app/auth/callback?redirect=%2Fonboarding",
        "https://legacy-confirm-host.example",
      ),
    ).toBe("https://coachhouse.app/onboarding")
    expect(
      resolveAuthConfirmationDestination(
        "https://example.com/auth/callback?redirect=%2Fonboarding",
        "https://coachhouse.app",
      ),
    ).toBe("/workspace")
    expect(resolveAuthConfirmationDestination("//example.com/onboarding")).toBe("/workspace")
  })

  it("keeps confirmation error redirects on the login route", () => {
    expect(
      buildLoginUrlWithAuthConfirmationError({
        destination: "/onboarding?source=home_signup",
        message: "Invalid link.",
      }),
    ).toBe(
      "/login?redirect=%2Fonboarding%3Fsource%3Dhome_signup&error=Invalid+link.",
    )
    expect(
      buildLoginUrlWithAuthConfirmationError({
        destination: "https://coachhouse.app/onboarding?source=home_signup",
        message: "Invalid link.",
      }),
    ).toBe(
      "https://coachhouse.app/login?redirect=%2Fonboarding%3Fsource%3Dhome_signup&error=Invalid+link.",
    )
  })

  it("accepts the Supabase email OTP type used by custom confirmation templates", () => {
    expect(getSafeEmailOtpType("email")).toBe("email")
    expect(getSafeEmailOtpType("unsupported")).toBeNull()
  })

  it("sends cross-origin confirmations to branded login with the redirect preserved", () => {
    expect(
      resolvePostAuthConfirmationRedirect(
        "https://coachhouse.app/onboarding?source=home_signup",
        "https://legacy-confirm-host.example",
      ),
    ).toBe(
      "https://coachhouse.app/login?redirect=%2Fonboarding%3Fsource%3Dhome_signup&notice=email_confirmed_sign_in",
    )
    expect(
      resolvePostAuthConfirmationRedirect(
        "https://coachhouse.app/onboarding?source=home_signup",
        "https://coachhouse.app",
      ),
    ).toBe("https://coachhouse.app/onboarding?source=home_signup")
    expect(resolvePostAuthConfirmationRedirect("/onboarding", "http://localhost:3000")).toBe(
      "/onboarding",
    )
  })
})

describe("human password recovery confirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    headersMock.mockResolvedValue({ get: (name: string) => name === "host" ? "coachhouse.app" : undefined })
  })

  it("renders recovery email links with an explicit recovery type, independent of the provider redirect", () => {
    const preview = buildSupabaseAuthEmailPreviews("https://coachhouse.app").find(
      (item) => item.id === "supabase-reset-password",
    )!
    expect(preview.html).toContain("https://coachhouse.app/auth/confirm?token_hash={{ .TokenHash }}")
    expect(preview.html).toContain("type=recovery")
    expect(preview.html).not.toContain("{{ .ConfirmationURL }}")

    const rendered = preview.html
      .replaceAll("{{ .TokenHash }}", "test-token")
      .replaceAll("{{ .RedirectTo }}", encodeURIComponent("https://coachhouse.app"))
    const emailLink = new URL(rendered.match(/href="([^"]*\/auth\/confirm[^"]*)"/)![1].replaceAll("&amp;", "&"))
    expect(emailLink.searchParams.get("type")).toBe("recovery")
    expect(emailLink.searchParams.get("token_hash")).toBe("test-token")
    expect(emailLink.searchParams.get("next")).toBe("https://coachhouse.app")
  })

  it.each([
    { label: "missing", next: undefined, postReset: "/workspace" },
    { label: "bare provider SiteURL", next: "https://coachhouse.app", postReset: null },
    {
      label: "nested callback",
      next: `https://coachhouse.app/auth/callback?redirect=${encodeURIComponent("/update-password?redirect=%2Fworkspace%3Fview%3Ddocuments")}`,
      postReset: "/workspace?view=documents",
    },
    { label: "external", next: "https://example.com/workspace", postReset: "/workspace" },
    { label: "explicit workspace", next: "/workspace", postReset: "/workspace" },
    { label: "reset path lookalike", next: "/update-password-other", postReset: "/update-password-other" },
  ])("verifies only on human submission and opens the reset form for $label destinations", async ({ next, postReset }) => {
    const verifyOtp = vi.fn().mockResolvedValue({
      data: { user: { user_metadata: { onboarding_completed: true } } }, error: null,
    })
    createSupabaseServerClientServerMock.mockResolvedValue({ auth: { verifyOtp } })
    const { default: ConfirmEmailPage } = await import("@/app/auth/confirm/page")
    const page = await ConfirmEmailPage({ searchParams: Promise.resolve({ token_hash: "test-token", type: "recovery", next }) })
    const form = page.props.children.props.children
    expect(page.props.children.props.title).toBe("Reset your password")
    expect(verifyOtp).not.toHaveBeenCalled()
    const formData = new FormData()
    for (const input of form.props.children.filter((child: { type: string }) => child.type === "input")) {
      formData.set(input.props.name, input.props.value)
    }

    const destination = new URL(await captureRedirect(() => form.props.action(formData)), "https://coachhouse.app")
    expect(destination.origin).toBe("https://coachhouse.app")
    expect(destination.pathname).toBe("/update-password")
    expect(destination.searchParams.get("redirect")).toBe(postReset)
    expect(verifyOtp).toHaveBeenCalledOnce()
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "test-token", type: "recovery" })
  })

  it.each(["expired", "missing"])("shows reset retry after a %s token even when a user is already signed in", async (tokenState) => {
    const verifyOtp = vi.fn().mockResolvedValue({
      data: { user: { id: "already-signed-in" } }, error: { message: "Token expired" },
    })
    createSupabaseServerClientServerMock.mockResolvedValue({ auth: { verifyOtp } })
    const { default: ConfirmEmailPage } = await import("@/app/auth/confirm/page")
    const page = await ConfirmEmailPage({ searchParams: Promise.resolve({ token_hash: "test-token", type: "recovery", next: "/workspace" }) })
    const form = page.props.children.props.children
    const formData = new FormData()
    for (const input of form.props.children.filter((child: { type: string }) => child.type === "input")) {
      formData.set(input.props.name, input.props.value)
    }
    if (tokenState === "missing") formData.delete("token_hash")

    const destination = new URL(await captureRedirect(() => form.props.action(formData)), "https://coachhouse.app")
    const recoveryError = tokenState === "missing" ? "missing_code" : "invalid_or_expired"
    expect(destination.pathname).toBe("/update-password")
    expect(destination.searchParams.get("recovery_error")).toBe(recoveryError)
    expect(verifyOtp).toHaveBeenCalledTimes(tokenState === "missing" ? 0 : 1)
    const { resolveUpdatePasswordPageState } = await import("@/app/(auth)/update-password/page")
    expect(resolveUpdatePasswordPageState(Object.fromEntries(destination.searchParams), { hasServerUser: true }))
      .toMatchObject({ initialStatus: "retry", recoveryError })
  })

  it("routes a recovery email missing its token directly to reset retry without verifying", async () => {
    const { default: ConfirmEmailPage } = await import("@/app/auth/confirm/page")
    const destination = new URL(await captureRedirect(() => ConfirmEmailPage({
      searchParams: Promise.resolve({ type: "recovery", next: "https://coachhouse.app" }),
    })), "https://coachhouse.app")
    expect(destination.pathname).toBe("/update-password")
    expect(destination.searchParams.get("recovery_error")).toBe("missing_code")
    expect(createSupabaseServerClientServerMock).not.toHaveBeenCalled()
  })

  it("does not trust a forged form origin to authorize an external reset destination", async () => {
    const verifyOtp = vi.fn().mockResolvedValue({ data: { user: { id: "recovery-user" } }, error: null })
    createSupabaseServerClientServerMock.mockResolvedValue({ auth: { verifyOtp } })
    const { default: ConfirmEmailPage } = await import("@/app/auth/confirm/page")
    const page = await ConfirmEmailPage({ searchParams: Promise.resolve({ token_hash: "test-token", type: "recovery", next: "/workspace" }) })
    const form = page.props.children.props.children
    const formData = new FormData()
    for (const input of form.props.children.filter((child: { type: string }) => child.type === "input")) {
      formData.set(input.props.name, input.props.value)
    }
    formData.set("request_origin", "https://example.com")
    formData.set("destination", "https://example.com/update-password")

    const destination = new URL(await captureRedirect(() => form.props.action(formData)), "https://coachhouse.app")
    expect(destination.origin).toBe("https://coachhouse.app")
    expect(destination.pathname).toBe("/update-password")
    expect(destination.searchParams.get("redirect")).toBe("/workspace")
  })
})
