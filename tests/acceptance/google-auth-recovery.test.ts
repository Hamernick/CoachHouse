import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  createGoogleAuthDiagnostics,
  formatGoogleAuthDiagnostics,
  getCanonicalGoogleLoginHref,
} from "@/features/google-auth/lib/recovery"

const details = {
  reference: "support-123",
  timestamp: "2026-10-27T00:00:00Z",
  origin: "https://coachhouse.app/login?token=private#password=private",
  clientId: "123-example.apps.googleusercontent.com",
  release: "abc123",
  mode: "login" as const,
  stage: "button_clicked" as const,
}

describe("Google sign-in support details", () => {
  it("copies only public origin, configuration and observed steps", () => {
    const report = createGoogleAuthDiagnostics({
      ...details,
      lastFailure: "exchange_failed",
    })
    const copied = JSON.parse(
      formatGoogleAuthDiagnostics({
        ...report,
        credential: "secret",
        email: "private@example.com",
      } as typeof report)
    )
    expect(copied).toEqual({
      ...details,
      origin: "https://coachhouse.app",
      timestamp: "2026-10-27T00:00:00.000Z",
      lastFailure: "exchange_failed",
    })
    expect(JSON.stringify(copied)).not.toMatch(
      /private|secret|credential|email|password|token=/
    )
  })

  it("rejects malformed configuration and drops URL credentials, query and fragment", () => {
    expect(
      createGoogleAuthDiagnostics({
        ...details,
        origin: "https://user:password@example.com:8443/path?code=secret#token",
        clientId: "private-value",
        release: "https://secret.example",
        timestamp: "bad",
      })
    ).toMatchObject({
      origin: "https://example.com:8443",
      clientId: "unavailable",
      release: "unavailable",
      timestamp: "unavailable",
    })
    expect(
      createGoogleAuthDiagnostics({ ...details, origin: "javascript:alert(1)" })
        .origin
    ).toBe("unavailable")
  })

  it("keeps safe return state on the canonical login link", () => {
    const url = new URL(
      getCanonicalGoogleLoginHref("/join-organization?token=fixture-invite")
    )
    expect(url.origin + url.pathname).toBe("https://coachhouse.app/login")
    expect(url.searchParams.get("redirect")).toBe(
      "/join-organization?token=fixture-invite"
    )
  })

  it.each([
    "https://evil.example",
    "//evil.example",
    "/%2f%2fevil.example",
    "/login",
  ])(
    "does not carry unsafe or looping return destination %s",
    (destination) => {
      expect(
        new URL(getCanonicalGoogleLoginHref(destination)).searchParams.get(
          "redirect"
        )
      ).toBe("/workspace")
    }
  )
})

describe("Google SDK recovery", () => {
  type Script = {
    src?: string
    id?: string
    async?: boolean
    onload: null | (() => void)
    onerror: null | (() => void)
    remove: ReturnType<typeof vi.fn>
  }
  let scripts: Script[]
  let browser: {
    google?: { accounts: { id: object } }
    setTimeout: typeof setTimeout
    clearTimeout: typeof clearTimeout
  }
  beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers()
    scripts = []
    browser = { setTimeout, clearTimeout }
    vi.stubGlobal("window", browser)
    vi.stubGlobal("document", {
      createElement: () => ({ onload: null, onerror: null, remove: vi.fn() }),
      head: {
        appendChild: (script: Script) => {
          scripts.push(script)
        },
      },
    })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it("deduplicates loading and reuses the available SDK", async () => {
    const { loadGoogleIdentityScript } =
      await import("@/features/google-auth/lib/identity-script")
    const first = loadGoogleIdentityScript()
    expect(loadGoogleIdentityScript()).toBe(first)
    expect(scripts).toHaveLength(1)
    expect(scripts[0].src).toBe("https://accounts.google.com/gsi/client")
    browser.google = { accounts: { id: {} } }
    scripts[0].onload!()
    await first
    await loadGoogleIdentityScript()
    expect(scripts).toHaveLength(1)
  })

  it("recovers from a failed script without refreshing or clearing browser storage", async () => {
    const { loadGoogleIdentityScript } =
      await import("@/features/google-auth/lib/identity-script")
    const first = loadGoogleIdentityScript()
    const failure = expect(first).rejects.toThrow("unavailable")
    scripts[0].onerror!()
    await failure
    expect(scripts[0].remove).toHaveBeenCalledOnce()
    const retry = loadGoogleIdentityScript()
    expect(scripts).toHaveLength(2)
    browser.google = { accounts: { id: {} } }
    scripts[1].onload!()
    await retry
  })

  it("times out a hanging SDK and permits an explicit retry", async () => {
    const { loadGoogleIdentityScript } =
      await import("@/features/google-auth/lib/identity-script")
    const failure = expect(loadGoogleIdentityScript()).rejects.toThrow(
      "unavailable"
    )
    await vi.advanceTimersByTimeAsync(15_000)
    await failure
    const retry = loadGoogleIdentityScript()
    browser.google = { accounts: { id: {} } }
    scripts[1].onload!()
    await retry
    expect(scripts).toHaveLength(2)
  })
})
