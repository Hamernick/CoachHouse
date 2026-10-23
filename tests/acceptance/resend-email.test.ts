import { afterEach, describe, expect, it, vi } from "vitest"

import { canSendResendEmail, sendResendEmail } from "@/lib/email/resend"
import { MINIMAL_EMAIL_RESPONSIVE_STYLE, renderMinimalEmail } from "@/lib/email/minimal-template"
import { env } from "@/lib/env"

const originalEnv = {
  RESEND_API_KEY: env.RESEND_API_KEY,
  RESEND_AUTH_EMAIL_API_KEY: env.RESEND_AUTH_EMAIL_API_KEY,
  RESEND_FROM_EMAIL: env.RESEND_FROM_EMAIL,
  RESEND_FROM_NAME: env.RESEND_FROM_NAME,
  RESEND_UNSUBSCRIBE_EMAIL: env.RESEND_UNSUBSCRIBE_EMAIL,
  RESEND_UNSUBSCRIBE_URL: env.RESEND_UNSUBSCRIBE_URL,
  EMAIL_OPS_TOKEN_SECRET: env.EMAIL_OPS_TOKEN_SECRET,
  NEXT_PUBLIC_SITE_URL: env.NEXT_PUBLIC_SITE_URL,
}

describe("resend email helper", () => {
  afterEach(() => {
    env.RESEND_API_KEY = originalEnv.RESEND_API_KEY
    env.RESEND_AUTH_EMAIL_API_KEY = originalEnv.RESEND_AUTH_EMAIL_API_KEY
    env.RESEND_FROM_EMAIL = originalEnv.RESEND_FROM_EMAIL
    env.RESEND_FROM_NAME = originalEnv.RESEND_FROM_NAME
    env.RESEND_UNSUBSCRIBE_EMAIL = originalEnv.RESEND_UNSUBSCRIBE_EMAIL
    env.RESEND_UNSUBSCRIBE_URL = originalEnv.RESEND_UNSUBSCRIBE_URL
    env.EMAIL_OPS_TOKEN_SECRET = originalEnv.EMAIL_OPS_TOKEN_SECRET
    env.NEXT_PUBLIC_SITE_URL = originalEnv.NEXT_PUBLIC_SITE_URL
    vi.unstubAllGlobals()
  })

  it("delivers the shared renderer with its exact responsive CSS and matching text", async () => {
    env.RESEND_API_KEY = "re_test"
    env.RESEND_FROM_EMAIL = "hello@coachhouse.app"
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "minimal-id" }), { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)
    const rendered = renderMinimalEmail({ title: "Review application", details: [{ label: "Project", value: "Northside" }], action: { label: "Review", href: "https://coachhouse.app/projects/sample" } })
    const result = await sendResendEmail({ to: "sample@example.test", subject: "New FS application: Northside", ...rendered })
    expect(result).toEqual({ ok: true, id: "minimal-id" })
    const wire = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(wire.html).toBe(rendered.html)
    expect(wire.html).toContain(MINIMAL_EMAIL_RESPONSIVE_STYLE)
    expect(wire.text).toBe(rendered.text)
  })

  it.each([
    '<meta http-equiv="refresh" content="0;url=https://example.test">',
    '<meta charset="utf-8" onload="bad()">',
    '<script>bad()</script>',
    '<p onclick="bad()">Dangerous</p>',
  ])("blocks authored active HTML despite the safe shared shell: %s", async (unsafe) => {
    env.RESEND_API_KEY = "re_test"
    env.RESEND_FROM_EMAIL = "hello@coachhouse.app"
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const rendered = renderMinimalEmail({ title: "Update" })
    const result = await sendResendEmail({ to: "sample@example.test", subject: "Update", ...rendered, html: rendered.html + unsafe })
    expect(result.ok).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    '<style>@import url("https://example.test/tracking.css");</style>',
    '<style>body{background:url(https://example.test/tracking)}</style>',
    '<style>@import url("https://example.test/tracking.css");',
  ])("strips arbitrary styles while retaining only exact generated CSS: %s", async (unsafe) => {
    env.RESEND_API_KEY = "re_test"
    env.RESEND_FROM_EMAIL = "hello@coachhouse.app"
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "safe-style-id" }), { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)
    const rendered = renderMinimalEmail({ title: "Update" })
    const result = await sendResendEmail({ to: "sample@example.test", subject: "Update", ...rendered, html: rendered.html + unsafe })
    expect(result.ok).toBe(true)
    const wire = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(wire.html).toBe(rendered.html)
    expect(wire.html).toContain(MINIMAL_EMAIL_RESPONSIVE_STYLE)
    expect(wire.html).not.toContain("@import")
    expect(wire.html).not.toContain("example.test/tracking")
  })

  it("includes explicit staff CC recipients in the provider request", async () => {
    env.RESEND_API_KEY = "re_test"
    env.RESEND_FROM_EMAIL = "hello@coachhouse.app"
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "cc-id" }), { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)
    expect(await sendResendEmail({ to: "joel@example.test", cc: ["caleb@example.test"], subject: "Application", html: "<p>Review application</p>", text: "Review application" })).toEqual({ ok: true, id: "cc-id" })
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ to: ["joel@example.test"], cc: ["caleb@example.test"] })
  })

  it("omits live unsubscribe headers for fixture samples while normal delivery retains them", async () => {
    env.RESEND_API_KEY = "re_test"
    env.RESEND_FROM_EMAIL = "hello@coachhouse.app"
    env.RESEND_UNSUBSCRIBE_URL = "https://coach.test/unsubscribe-live"
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "sample" }), { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)
    const mail = { to: "caleb@bandto.com", subject: "Sample", html: "<p>Sample</p>", text: "Sample" }
    await sendResendEmail({ ...mail, omitUnsubscribeHeaders: true })
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).headers).toBeUndefined()
    await sendResendEmail(mail)
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).headers["List-Unsubscribe"]).toContain("https://coach.test/unsubscribe-live")
  })

  it("uses the canonical Resend API key when configured", async () => {
    env.RESEND_API_KEY = "re_canonical"
    env.RESEND_AUTH_EMAIL_API_KEY = "re_auth_alias"
    env.RESEND_FROM_EMAIL = "updates@coachhouse.app"
    env.RESEND_FROM_NAME = "Coach House"
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "email_canonical" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )
    vi.stubGlobal("fetch", fetchMock)

    expect(canSendResendEmail()).toBe(true)

    const result = await sendResendEmail({
      to: "recipient@example.com",
      subject: "Invite",
      html: "<p>Hello</p>",
      text: "Hello",
    })

    expect(result).toEqual({ ok: true, id: "email_canonical" })
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        body: expect.stringContaining("Coach House <updates@coachhouse.app>"),
        headers: expect.objectContaining({
          Authorization: "Bearer re_canonical",
        }),
      }),
    )
  })

  it("accepts the auth email Resend key alias used in Vercel", async () => {
    env.RESEND_API_KEY = undefined
    env.RESEND_AUTH_EMAIL_API_KEY = "re_auth_alias"
    env.RESEND_FROM_EMAIL = "updates@coachhouse.app"
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "email_alias" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )
    vi.stubGlobal("fetch", fetchMock)

    expect(canSendResendEmail()).toBe(true)

    const result = await sendResendEmail({
      to: "recipient@example.com",
      subject: "Invite",
      html: "<p>Hello</p>",
      text: "Hello",
    })

    expect(result).toEqual({ ok: true, id: "email_alias" })
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer re_auth_alias",
        }),
      }),
    )
  })

  it("reports unavailable email delivery when no Resend key is configured", () => {
    env.RESEND_API_KEY = undefined
    env.RESEND_AUTH_EMAIL_API_KEY = undefined
    env.RESEND_FROM_EMAIL = "updates@coachhouse.app"

    expect(canSendResendEmail()).toBe(false)
  })

  it("reports unavailable email delivery when no sender email is configured", async () => {
    env.RESEND_API_KEY = "re_canonical"
    env.RESEND_AUTH_EMAIL_API_KEY = undefined
    env.RESEND_FROM_EMAIL = undefined

    expect(canSendResendEmail()).toBe(false)
    await expect(
      sendResendEmail({
        to: "recipient@example.com",
        subject: "Invite",
        html: "<p>Hello</p>",
        text: "Hello",
      })
    ).resolves.toEqual({
      ok: false,
      error: "RESEND_FROM_EMAIL is not configured.",
    })
  })

  it("normalizes tags before sending to Resend", async () => {
    env.RESEND_API_KEY = "re_canonical"
    env.RESEND_AUTH_EMAIL_API_KEY = undefined
    env.RESEND_FROM_EMAIL = "updates@coachhouse.app"
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "email_tags" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )
    vi.stubGlobal("fetch", fetchMock)

    await sendResendEmail({
      to: "recipient@example.com",
      subject: "Invite",
      html: "<p>Hello</p>",
      text: "Hello",
      tags: [
        { name: "category", value: "organization-access-request" },
        { name: "organization", value: "Coach House Solutions Group, NFP" },
      ],
    })

    const [, init] = fetchMock.mock.calls[0] ?? []
    const body = JSON.parse(String(init?.body)) as {
      tags?: Array<{ name: string; value: string }>
    }

    expect(body.tags).toEqual([
      { name: "category", value: "organization-access-request" },
      { name: "organization", value: "Coach-House-Solutions-Group-NFP" },
    ])
  })

  it("passes idempotency keys through the Resend request headers", async () => {
    env.RESEND_API_KEY = "re_canonical"
    env.RESEND_AUTH_EMAIL_API_KEY = undefined
    env.RESEND_FROM_EMAIL = "updates@coachhouse.app"
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "email_idempotent" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )
    vi.stubGlobal("fetch", fetchMock)

    await sendResendEmail({
      to: "recipient@example.com",
      subject: "Invite",
      html: "<p>Hello</p>",
      text: "Hello",
      idempotencyKey: "email-ops-test/recipient",
    })

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        headers: expect.objectContaining({
          "Idempotency-Key": "email-ops-test/recipient",
        }),
      }),
    )
  })

  it("generates signed one-click unsubscribe headers for marketing sends", async () => {
    env.RESEND_API_KEY = "re_canonical"
    env.RESEND_AUTH_EMAIL_API_KEY = undefined
    env.RESEND_FROM_EMAIL = "updates@coachhouse.app"
    env.RESEND_FROM_NAME = "Coach House"
    env.RESEND_UNSUBSCRIBE_EMAIL = "unsubscribe@coachhouse.app"
    env.EMAIL_OPS_TOKEN_SECRET = "email_ops_token_secret"
    env.NEXT_PUBLIC_SITE_URL = "https://coachhouse.app"
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "email_marketing" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const result = await sendResendEmail({
      to: "recipient@example.com",
      subject: "Product update",
      html: "<p>Hello</p>",
      text: "Hello",
      unsubscribe: {
        email: "recipient@example.com",
        topicId: "product_updates",
      },
    })

    expect(result).toEqual({ ok: true, id: "email_marketing" })
    const [, init] = fetchMock.mock.calls[0] ?? []
    const body = JSON.parse(String(init?.body)) as {
      headers?: Record<string, string>
    }

    expect(body.headers?.["List-Unsubscribe"]).toContain(
      "<mailto:unsubscribe@coachhouse.app>"
    )
    expect(body.headers?.["List-Unsubscribe"]).toContain(
      "https://coachhouse.app/api/email/unsubscribe?token="
    )
    expect(body.headers?.["List-Unsubscribe-Post"]).toBe(
      "List-Unsubscribe=One-Click"
    )
  })

  it("blocks dangerous html before calling Resend", async () => {
    env.RESEND_API_KEY = "re_canonical"
    env.RESEND_FROM_EMAIL = "updates@coachhouse.app"
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const result = await sendResendEmail({
      to: "recipient@example.com",
      subject: "Product update",
      html: "<p onclick=\"alert(1)\">Hello</p><script>alert(1)</script>",
      text: "Hello",
    })

    expect(result).toEqual({
      ok: false,
      error:
        "Email content failed safety checks: Email HTML contains blocked tags or event handlers.",
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
