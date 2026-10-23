import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest, type NextResponse } from "next/server"

const { createSupabaseRouteHandlerClientMock } = vi.hoisted(() => ({
  createSupabaseRouteHandlerClientMock: vi.fn(),
}))

vi.mock("@/lib/supabase/route", () => ({
  createSupabaseRouteHandlerClient: createSupabaseRouteHandlerClientMock,
}))

function buildRouteSupabaseStub(options?: {
  verifyOtpError?: { message: string } | null
  exchangeCodeError?: { message: string } | null
  redirectType?: string | null
}) {
  return {
    auth: {
      verifyOtp: vi.fn().mockResolvedValue({ error: options?.verifyOtpError ?? null }),
      exchangeCodeForSession: vi.fn().mockResolvedValue({
        data: { redirectType: options?.redirectType ?? null },
        error: options?.exchangeCodeError ?? null,
      }),
    },
  }
}

describe("auth recovery flow", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it.each([undefined, "/workspace", "/update-password-other"])(
    "keeps successful recovery OTPs on the reset form with destination %s",
    async (destination) => {
      const supabase = buildRouteSupabaseStub()
      createSupabaseRouteHandlerClientMock.mockReturnValue(supabase)
      const url = new URL("http://localhost/auth/callback?token_hash=test-token&type=recovery")
      if (destination) url.searchParams.set("redirect", destination)

      const { handleSupabaseAuthCallback } = await import("@/lib/supabase/auth-callback")
      const response = await handleSupabaseAuthCallback(new NextRequest(url))
      const location = new URL(response.headers.get("location")!)

      expect(location.pathname).toBe("/update-password")
      expect(location.searchParams.get("redirect")).toBe(destination ?? null)
      expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({ token_hash: "test-token", type: "recovery" })
      expect(supabase.auth.exchangeCodeForSession).not.toHaveBeenCalled()
    },
  )

  it("recovers the PKCE recovery type after the provider loses the redirect, preserving session cookies", async () => {
    const supabase = buildRouteSupabaseStub({ redirectType: "recovery" })
    createSupabaseRouteHandlerClientMock.mockImplementation((_request, response: NextResponse) => {
      supabase.auth.exchangeCodeForSession.mockImplementation(async () => {
        response.cookies.set("test-session", "verified-session", { httpOnly: true, path: "/" })
        return { data: { redirectType: "recovery" }, error: null }
      })
      return supabase
    })

    const { handleSupabaseAuthCallback } = await import("@/lib/supabase/auth-callback")
    const response = await handleSupabaseAuthCallback(
      new NextRequest("http://localhost/auth/callback?code=test-code"),
    )

    expect(new URL(response.headers.get("location")!).pathname).toBe("/update-password")
    expect(response.cookies.get("test-session")?.value).toBe("verified-session")
    expect(response.headers.get("set-cookie")).toContain("HttpOnly")
    expect(supabase.auth.exchangeCodeForSession).toHaveBeenCalledWith("test-code")
  })

  it.each([null, "signup"])("does not infer recovery from ordinary SDK redirect type %s", async (redirectType) => {
    createSupabaseRouteHandlerClientMock.mockReturnValue(buildRouteSupabaseStub({ redirectType }))
    const { handleSupabaseAuthCallback } = await import("@/lib/supabase/auth-callback")
    const response = await handleSupabaseAuthCallback(
      new NextRequest("http://localhost/auth/callback?code=test-code"),
    )
    expect(new URL(response.headers.get("location")!).pathname).toBe("/workspace")
  })

  it("redirects recovery OTP failures back to update-password with a retry state", async () => {
    const supabase = buildRouteSupabaseStub({
      verifyOtpError: { message: "otp expired" },
    })
    createSupabaseRouteHandlerClientMock.mockReturnValue(supabase)

    const { handleSupabaseAuthCallback } = await import("@/lib/supabase/auth-callback")
    const response = await handleSupabaseAuthCallback(
      new NextRequest(
        "http://localhost/auth/callback?token_hash=test-token&type=recovery&redirect=%2Fupdate-password%3Fredirect%3D%252Fworkspace",
      ),
    )

    const location = new URL(response.headers.get("location") ?? "http://localhost/")
    expect(location.pathname).toBe("/update-password")
    expect(location.searchParams.get("redirect")).toBe("/workspace")
    expect(location.searchParams.get("recovery_error")).toBe("invalid_or_expired")
  })

  it("redirects recovery code exchange failures back to update-password instead of login", async () => {
    const supabase = buildRouteSupabaseStub({
      exchangeCodeError: { message: "session exchange failed" },
    })
    createSupabaseRouteHandlerClientMock.mockReturnValue(supabase)

    const { handleSupabaseAuthCallback } = await import("@/lib/supabase/auth-callback")
    const response = await handleSupabaseAuthCallback(
      new NextRequest(
        "http://localhost/auth/callback?code=test-code&redirect=%2Fupdate-password",
      ),
    )

    const location = new URL(response.headers.get("location") ?? "http://localhost/")
    expect(location.pathname).toBe("/update-password")
    expect(location.searchParams.get("recovery_error")).toBe("invalid_or_expired")
  })

  it("keeps signup PKCE fallback on the login notice path", async () => {
    const supabase = buildRouteSupabaseStub({
      exchangeCodeError: { message: "PKCE code verifier not found in storage" },
    })
    createSupabaseRouteHandlerClientMock.mockReturnValue(supabase)

    const { handleSupabaseAuthCallback } = await import("@/lib/supabase/auth-callback")
    const response = await handleSupabaseAuthCallback(
      new NextRequest("http://localhost/auth/callback?code=test-code&type=signup"),
    )

    const location = new URL(response.headers.get("location") ?? "http://localhost/")
    expect(location.pathname).toBe("/login")
    expect(location.searchParams.get("notice")).toBe("email_confirmed_sign_in")
  })

  it("keeps PKCE fallback on the login notice path even when the callback lacks an explicit signup type", async () => {
    const supabase = buildRouteSupabaseStub({
      exchangeCodeError: { message: "PKCE code verifier not found in storage" },
    })
    createSupabaseRouteHandlerClientMock.mockReturnValue(supabase)

    const { handleSupabaseAuthCallback } = await import("@/lib/supabase/auth-callback")
    const response = await handleSupabaseAuthCallback(
      new NextRequest("http://localhost/auth/callback?code=test-code"),
    )

    const location = new URL(response.headers.get("location") ?? "http://localhost/")
    expect(location.pathname).toBe("/login")
    expect(location.searchParams.get("notice")).toBe("email_confirmed_sign_in")
  })

  it("falls back to workspace after a successful non-recovery auth callback without an explicit redirect", async () => {
    const supabase = buildRouteSupabaseStub()
    createSupabaseRouteHandlerClientMock.mockReturnValue(supabase)

    const { handleSupabaseAuthCallback } = await import("@/lib/supabase/auth-callback")
    const response = await handleSupabaseAuthCallback(
      new NextRequest("http://localhost/auth/callback?code=test-code"),
    )

    const location = new URL(response.headers.get("location") ?? "http://localhost/")
    expect(location.pathname).toBe("/workspace")
  })

  it.each([false, true])("keeps invalid recovery in retry state with existing user %s", async (hasServerUser) => {
    const { resolveUpdatePasswordPageState } = await import("@/app/(auth)/update-password/page")

    expect(
      resolveUpdatePasswordPageState(
        {
          redirect: "/workspace",
          recovery_error: "invalid_or_expired",
        },
        { hasServerUser },
      ),
    ).toEqual({
      redirect: "/workspace",
      recoveryError: "invalid_or_expired",
      initialStatus: "retry",
    })
  })

  it("keeps the reset form ready when the recovery session is already present", async () => {
    const { resolveUpdatePasswordPageState } = await import("@/app/(auth)/update-password/page")
    const { getUpdatePasswordRetryMessage } = await import("@/components/auth/update-password-form")
    const { buildForgotPasswordCallbackRedirect } = await import(
      "@/components/auth/forgot-password-form"
    )

    expect(
      resolveUpdatePasswordPageState({}, { hasServerUser: true }),
    ).toEqual({
      redirect: undefined,
      recoveryError: null,
      initialStatus: "ready",
    })
    expect(getUpdatePasswordRetryMessage("missing_code")).toBe(
      "This reset link is incomplete. Request a new reset email and try again.",
    )
    expect(buildForgotPasswordCallbackRedirect("/workspace")).toBe(
      "/update-password?redirect=%2Fworkspace",
    )
  })
})
