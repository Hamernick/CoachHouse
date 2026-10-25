import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { getPublicSiteOrigin } from "@/lib/public-site-origin"
import robots from "@/app/robots"

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "development")
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "")
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "")
  vi.stubEnv("VERCEL_URL", "")
})
afterEach(() => vi.unstubAllEnvs())

describe("absolute public metadata origin", () => {
  it("uses the configured public domain ahead of app and deployment hosts", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", " https://coachhouse.app/path?ignored=1 ")
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example.org")
    vi.stubEnv("VERCEL_URL", "preview.example.org")
    expect(getPublicSiteOrigin()).toBe("https://coachhouse.app")
    expect(robots().sitemap).toEqual(["https://coachhouse.app/sitemap.xml", "https://coachhouse.app/sitemap-index.xml"])
  })

  it("retains app, deployment and local fallbacks", () => {
    expect(getPublicSiteOrigin()).toBe("http://localhost:3000")
    vi.stubEnv("VERCEL_URL", "preview.example.org")
    expect(getPublicSiteOrigin()).toBe("https://preview.example.org")
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3119/app")
    expect(getPublicSiteOrigin()).toBe("http://localhost:3119")
  })

  it.each(["invalid", "javascript:alert(1)", "https://user:secret@example.org"])(
    "does not publish an invalid or credential-bearing metadata origin: %s", (url) => {
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", url)
      expect(getPublicSiteOrigin()).toBe("http://localhost:3000")
    },
  )

  it("uses the production canonical domain instead of a deployment host", () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("VERCEL_URL", "coach-house-preview.vercel.app")
    expect(getPublicSiteOrigin()).toBe("https://coachhouse.app")
    expect(robots().sitemap).toEqual(["https://coachhouse.app/sitemap.xml", "https://coachhouse.app/sitemap-index.xml"])
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.coachhouse.app/path")
    expect(getPublicSiteOrigin()).toBe("https://www.coachhouse.app")
  })

  it.each([
    "http://localhost:3000",
    "https://localhost",
    "https://127.0.0.1",
    "https://[::1]",
    "https://coach-house-preview.vercel.app",
    "invalid",
  ])("does not leak a local or preview production origin: %s", (url) => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", url)
    expect(getPublicSiteOrigin()).toBe("https://coachhouse.app")
  })
})
