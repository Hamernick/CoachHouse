import { describe, expect, it } from "vitest"

import { filterPrivateTelemetry } from "@/lib/telemetry-privacy"

describe("analytics URL privacy", () => {
  it.each([
    "/login?redirect=%2Fjoin-organization%3Ftoken%3Dfixture-invite&email=fixture%40example.org",
    "/auth/callback?code=fixture-oauth-code&state=fixture-state",
    "/update-password#access_token=fixture-access&refresh_token=fixture-refresh",
    "/join-organization?token=fixture-invite",
    "/unsubscribe?token=fixture-unsubscribe",
    "/resources?q=fixture-sensitive-search#result",
  ])("removes query and fragment data from %s without mutating the event", (path) => {
    const original = Object.freeze({ type: "pageview", url: `https://coach.test${path}`, route: "/resources" })
    const filtered = filterPrivateTelemetry(original)
    expect(filtered).toEqual({ ...original, url: `https://coach.test${path.split(/[?#]/)[0]}` })
    expect(original.url).toBe(`https://coach.test${path}`)
  })

  it.each([
    "/documentation/fiscal-sponsorship/verify?token=fixture-proof",
    "/documentation/fiscal-sponsorship/profile/",
    "/documentation/fiscal-sponsorship/application?application=fixture-id",
    "/documentation/fiscal-sponsorship/recover",
    "/fiscal-sponsorship/sign/fixture-packet",
    "/fiscal-sponsorship/w9/fixture-project",
    "/%66iscal-sponsorship/sign/fixture-packet",
  ])("suppresses private workflow URLs, including identifiers in paths: %s", (path) => {
    expect(filterPrivateTelemetry({ url: `https://coach.test${path}` })).toBeNull()
  })

  it.each([
    "/",
    "/pricing",
    "/documentation/fiscal-sponsorship",
    "/documentation/fiscal-sponsorship/profile-guide",
  ])("keeps ordinary page measurement at %s", (path) => {
    const event = { url: `https://coach.test${path}`, type: "pageview" }
    expect(filterPrivateTelemetry(event)).toBe(event)
  })

  it.each([
    "invalid",
    "javascript:alert(1)",
    "file:///private/document",
    "https://fixture-user:fixture-password@coach.test/pricing",
    "https://coach.test/%ZZ",
  ])("fails closed for unsupported or malformed URLs: %s", (url) => {
    expect(filterPrivateTelemetry({ url })).toBeNull()
  })
})
