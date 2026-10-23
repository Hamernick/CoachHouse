import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import { EMAIL_SAMPLE_RECIPIENT, sampleMessage, sendEmailSampleSuite, writeEmailSamplePreviews, type EmailSample } from "@/lib/email/sample-suite"

const sample: EmailSample = { id: "example-one", category: "account", state: "confirmation", source: "fixture", subject: "Confirm your email", html: '<p>Example <a href="https://example.com/coach-house-email-preview/example-one">Review sample</a></p>', text: "Example: https://example.com/coach-house-email-preview/example-one" }
const directories: string[] = []
async function directory() { const value = await mkdtemp(path.join(os.tmpdir(), "coach-house-email-samples-")); directories.push(value); return value }
afterEach(async () => { await Promise.all(directories.splice(0).map((value) => rm(value, { recursive: true, force: true }))) })

describe("platform email sample suite", () => {
  it("fixes the only recipient, excludes CC, and uses stable content-specific idempotency", () => {
    const message = sampleMessage(sample, 0, 2, "review-one")
    expect(message).toMatchObject({ to: EMAIL_SAMPLE_RECIPIENT, subject: "[TEST 01/2] Confirm your email", omitUnsubscribeHeaders: true })
    expect(message).not.toHaveProperty("cc")
    expect(message).not.toHaveProperty("bcc")
    expect(message).toEqual(sampleMessage(sample, 0, 2, "review-one"))
    expect(message.idempotencyKey).not.toBe(sampleMessage({ ...sample, html: "Changed" }, 0, 2, "review-one").idempotencyKey)
    expect(message.idempotencyKey).not.toBe(sampleMessage(sample, 0, 2, "review-two").idempotencyKey)
    expect(() => sampleMessage({ ...sample, id: "../bad" }, 0, 1, "review-one")).toThrow("identifier")
  })

  it("writes private gallery, individual HTML/text and explicit provider coverage without sending", async () => {
    const output = await directory()
    await writeEmailSamplePreviews(output, [sample], [{ provider: "Stripe", limitation: "Provider-managed preview only" }])
    expect(await readFile(path.join(output, "example-one.html"), "utf8")).toBe(sample.html)
    expect(await readFile(path.join(output, "example-one.txt"), "utf8")).toBe(sample.text)
    expect(await readFile(path.join(output, "index.html"), "utf8")).toContain("iframe title=")
    expect(JSON.parse(await readFile(path.join(output, "coverage.json"), "utf8"))).toMatchObject({ fictionalData: true, recipient: EMAIL_SAMPLE_RECIPIENT, exceptions: [{ provider: "Stripe" }] })
    expect((await stat(path.join(output, "coverage.json"))).mode & 0o777).toBe(0o600)
  })

  it("journals before the provider call and skips accepted sends when resumed", async () => {
    const output = await directory(), send = vi.fn(async () => {
      const journal = JSON.parse(await readFile(path.join(output, "receipts-review-one.json"), "utf8"))
      expect(journal.receipts[0].status).toBe("attempting")
      return { ok: true as const, id: "provider-123" }
    })
    const args = { output, batch: "review-one", samples: [sample], send }
    expect((await sendEmailSampleSuite(args)).receipts[0]).toMatchObject({ status: "accepted", providerId: "provider-123" })
    await sendEmailSampleSuite(args)
    expect(send).toHaveBeenCalledTimes(1)
  })

  it("stops on uncertain response and does not blindly resend it", async () => {
    const output = await directory(), send = vi.fn().mockRejectedValue(new Error("network timeout"))
    const args = { output, batch: "review-one", samples: [sample], send }
    await expect(sendEmailSampleSuite(args)).rejects.toThrow("Uncertain delivery")
    await expect(sendEmailSampleSuite(args)).rejects.toThrow("Uncertain delivery")
    expect(send).toHaveBeenCalledTimes(1)
    expect(await readFile(path.join(output, "receipts-review-one.json"), "utf8")).not.toContain("network timeout")
  })

  it("records rejection without treating it as permission to retry automatically", async () => {
    const output = await directory(), send = vi.fn().mockResolvedValueOnce({ ok: false, error: "rejected" }).mockResolvedValue({ ok: true, id: "retry-123" })
    const args = { output, batch: "review-one", samples: [sample], send }
    await expect(sendEmailSampleSuite(args)).rejects.toThrow("Provider rejected")
    await expect(sendEmailSampleSuite(args)).rejects.toThrow("Previous sample was rejected")
    expect(send).toHaveBeenCalledTimes(1)
  })

  it("rejects changed content in an existing batch", async () => {
    const output = await directory(), send = vi.fn().mockResolvedValue({ ok: true, id: "provider-123" })
    await sendEmailSampleSuite({ output, batch: "review-one", samples: [sample], send })
    await expect(sendEmailSampleSuite({ output, batch: "review-one", samples: [{ ...sample, text: "Updated" }], send })).rejects.toThrow("Sample content changed")
    expect(send).toHaveBeenCalledTimes(1)
  })

  it("blocks concurrent runs and crashed in-flight attempts", async () => {
    const output = await directory(), send = vi.fn()
    await writeFile(path.join(output, "send.lock"), "")
    await expect(sendEmailSampleSuite({ output, batch: "review-one", samples: [sample], send })).rejects.toThrow("locked")
    await rm(path.join(output, "send.lock"))
    const message = sampleMessage(sample, 0, 1, "review-one")
    await writeFile(path.join(output, "receipts-review-one.json"), JSON.stringify({ batch: "review-one", recipient: EMAIL_SAMPLE_RECIPIENT, receipts: [{ id: sample.id, fingerprint: message.idempotencyKey.split("/").at(-1), key: message.idempotencyKey, status: "attempting" }] }))
    await expect(sendEmailSampleSuite({ output, batch: "review-one", samples: [sample], send })).rejects.toThrow("Uncertain delivery")
    expect(send).not.toHaveBeenCalled()
  })
})
