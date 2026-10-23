import { readFileSync } from "node:fs"
import { join } from "node:path"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { selectFiscalReviewerRecipientIds } from "@/features/fiscal-sponsorship/lib/reviewer-recipients"
import { canManageFiscalSponsorshipForOrganization, canReadGuestFiscalProject } from "@/features/fiscal-sponsorship/lib/authorization"

describe("guest fiscal reviewer authorization", () => {
  function client(data: boolean | null, error: object | null = null) {
    const assignment = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: { coach_user_id: "coach" }, error: null }) }
    const mock = { rpc: vi.fn().mockResolvedValue({ data, error }), from: vi.fn().mockReturnValue(assignment) }
    return { mock, supabase: mock as unknown as Parameters<typeof canManageFiscalSponsorshipForOrganization>[0]["supabase"] }
  }
  it("accepts an assigned guest reviewer without an organization assignment", async () => {
    const { mock, supabase } = client(true)
    expect(await canManageFiscalSponsorshipForOrganization({ accessLevel: "coach", organizationId: "host", projectId: "guest", userId: "coach", supabase })).toBe(true)
    expect(mock.from).not.toHaveBeenCalled()
    expect(mock.rpc).toHaveBeenCalledWith("fiscal_guest_project_reviewer_access", { p_project_id: "guest", p_user_id: "coach" })
  })
  it.each([false, null])("does not fall back to org assignment on denied/failed guest lookup (%s)", async (data) => {
    const { mock, supabase } = client(data, data === null ? { code: "unavailable" } : null)
    expect(await canManageFiscalSponsorshipForOrganization({ accessLevel: "coach", organizationId: "host", projectId: "guest", userId: "coach", supabase })).toBe(false)
    expect(mock.from).not.toHaveBeenCalled()
  })
  it("retains organization assignment for an ordinary project", async () => {
    const { mock, supabase } = client(null)
    expect(await canManageFiscalSponsorshipForOrganization({ accessLevel: "coach", organizationId: "host", projectId: "ordinary", userId: "coach", supabase })).toBe(true)
    expect(mock.from).toHaveBeenCalledWith("organization_coach_assignments")
  })
  it("blocks elevated-client reads for unassigned guests and lookup failures", async () => {
    for (const [data, error] of [[false, null], [null, { code: "unavailable" }]] as const) {
      const { supabase } = client(data, error)
      expect(await canReadGuestFiscalProject({ projectId: "guest", userId: "coach", supabase })).toBe(false)
    }
  })
})

const ROOT = process.cwd()

function readSource(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8")
}

describe("fiscal sponsorship coach milestones", () => {
  it("notifies developers and assigned coaches only", () => {
    expect(
      selectFiscalReviewerRecipientIds({
        assignments: [
          { coach_user_id: "coach-assigned" },
          { coach_user_id: "coach-actor" },
        ],
        excludeUserId: "coach-actor",
        staff: [
          { access_level: "developer", user_id: "developer" },
          { access_level: "coach", user_id: "coach-assigned" },
          { access_level: "coach", user_id: "coach-unassigned" },
          { access_level: "coach", user_id: "coach-actor" },
        ],
      })
    ).toEqual(["developer", "coach-assigned"])
  })

  it("routes review milestones to assigned reviewers", () => {
    const notifications = readSource(
      "src/features/fiscal-sponsorship/server/workflow-notifications.ts"
    )
    const signingActions = readSource(
      "src/features/fiscal-sponsorship/server/native-signing-actions.ts"
    )

    expect(notifications).toContain("organization_coach_assignments")
    expect(notifications).toContain("loadFiscalReviewerRecipientIds")
    expect(notifications).toContain("fiscal_sponsorship_application_submitted")
    expect(notifications).toContain("fiscal_sponsorship_document_connected")
    expect(notifications).toContain("fiscal_sponsorship_applicant_signed")
    expect(notifications).toContain("`/fiscal-sponsorship/sign/${packetId}`")
    expect(signingActions).toContain("notifyFiscalApplicantSigned")
  })

  it("limits review and countersign actions to assigned coaches", () => {
    const workflowSupport = readSource(
      "src/features/fiscal-sponsorship/server/workflow-support.ts"
    )
    const authorization = readSource(
      "src/features/fiscal-sponsorship/lib/authorization.ts"
    )
    const workflowActions = readSource(
      "src/features/fiscal-sponsorship/server/workflow-actions.ts"
    )
    const agreementActions = readSource(
      "src/features/fiscal-sponsorship/server/workflow-agreement-actions.ts"
    )
    const signingContext = readSource(
      "src/features/fiscal-sponsorship/server/native-signing-context.ts"
    )
    const organizationPage = readSource(
      "src/app/(dashboard)/organizations/[id]/page.tsx"
    )

    expect(workflowSupport).toContain(
      "canManageFiscalSponsorshipForOrganization"
    )
    expect(authorization).toContain("organization_coach_assignments")
    expect(authorization).toContain('accessLevel === "developer"')
    expect(authorization).toContain('accessLevel !== "coach"')
    expect(workflowActions).toContain(
      "canManageFiscalSponsorshipForOrganization"
    )
    expect(agreementActions).toContain(
      "canManageFiscalSponsorshipForOrganization"
    )
    expect(signingContext).toContain(
      "canManageFiscalSponsorshipForOrganization"
    )
    expect(organizationPage).toContain(
      "canManageFiscalSponsorshipForOrganization"
    )
  })
})


const deliveryMocks = vi.hoisted(() => ({ rpc: vi.fn(), send: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ rpc: deliveryMocks.rpc }) }))
vi.mock("@/lib/email/resend", () => ({ sendResendEmail: deliveryMocks.send, canSendResendEmail: () => true }))
vi.mock("@/lib/env", () => ({ env: { NEXT_PUBLIC_SITE_URL: "https://coachhouse.app" } }))
import { dispatchFiscalStaffEmails, handleFiscalEmailCron } from "@/features/fiscal-sponsorship/server/staff-email-dispatch"

const notificationJob = {
  event_id: "10000000-0000-4000-8000-000000000001",
  project_id: "10000000-0000-4000-8000-000000000002",
  lease_token: "10000000-0000-4000-8000-000000000003",
  event_type: "application_submitted",
}

describe("Karissa fiscal event emails", () => {
  beforeEach(() => {
    deliveryMocks.rpc.mockReset()
    deliveryMocks.send.mockReset().mockResolvedValue({ ok: true, id: "email-id" })
    vi.stubEnv("INTERNAL_CRON_SECRET", "test-cron-secret")
    vi.stubEnv("FISCAL_STAFF_EMAILS_ENABLED", "true")
    deliveryMocks.rpc.mockImplementation(async (name: string) => ({ data: name === "claim_fiscal_staff_emails_v2" ? [notificationJob] : true, error: null }))
  })
  afterEach(() => vi.unstubAllEnvs())
  it("does not dispatch staff messages without explicit activation", async () => {
    vi.stubEnv("FISCAL_STAFF_EMAILS_ENABLED", "false")
    await expect(dispatchFiscalStaffEmails()).rejects.toThrow("not configured")
    expect(deliveryMocks.rpc).not.toHaveBeenCalled()
    expect(deliveryMocks.send).not.toHaveBeenCalled()
  })
  it("denies unauthenticated queue dispatch without database or provider calls", async () => {
    const result = await handleFiscalEmailCron(new Request("https://coachhouse.app/api/internal/cron/fiscal-notifications"))
    expect(result.status).toBe(401)
    expect(deliveryMocks.rpc).not.toHaveBeenCalled()
    expect(deliveryMocks.send).not.toHaveBeenCalled()
  })
  it("emails the confirmed fiscal inbox with a stable event key and records provider acceptance", async () => {
    expect(await dispatchFiscalStaffEmails()).toEqual({ sent: 1, failed: 0 })
    expect(deliveryMocks.send).toHaveBeenCalledWith(expect.objectContaining({
      to: "fs@coachhousesolutions.org", idempotencyKey: `fiscal-staff-event/${notificationJob.event_id}`,
      text: expect.stringContaining(`/projects/${notificationJob.project_id}`),
    }))
    expect(deliveryMocks.rpc).toHaveBeenLastCalledWith("finish_fiscal_staff_email", {
      p_event_id: notificationJob.event_id, p_lease_token: notificationJob.lease_token, p_message_id: "email-id", p_success: true,
    })
  })
  it("sends Karissa the application digest with Caleb copied and a stable new key", async () => {
    deliveryMocks.rpc.mockImplementation(async (name: string) => ({ data: name === "claim_fiscal_staff_emails_v2" ? [{ ...notificationJob, template_version: 2, to_recipients: ["joel@coachhousesolutions.org", "fs@coachhousesolutions.org"], cc_recipients: ["caleb@bandto.com"], message_snapshot: { projectName: "Community garden" }, review_snapshot: { project_name: "Community garden", project_description: "Grow together", corrections: true } }] : true, error: null }))
    await dispatchFiscalStaffEmails(); await dispatchFiscalStaffEmails()
    const mail = deliveryMocks.send.mock.calls[0][0]
    expect(mail).toMatchObject({ to: ["joel@coachhousesolutions.org", "fs@coachhousesolutions.org"], cc: ["caleb@bandto.com"], subject: "FS corrections received: Community garden", idempotencyKey: `fiscal-staff-minimal-v1/${notificationJob.event_id}` })
    expect(mail.text).toContain("Grow together")
    expect(mail.html).toContain("Review application</a>")
    expect(JSON.stringify(deliveryMocks.send.mock.calls[1][0])).toEqual(JSON.stringify(mail))
  })
  it("uses the legacy staff worker only when the new function is absent", async () => {
    deliveryMocks.rpc.mockImplementation(async (name: string) => name === "claim_fiscal_staff_emails_v2" ? { data: null, error: { code: "PGRST202" } } : { data: name === "claim_fiscal_staff_emails" ? [notificationJob] : true, error: null })
    expect(await dispatchFiscalStaffEmails()).toEqual({ sent: 1, failed: 0 })
    expect(deliveryMocks.send.mock.calls[0][0]).not.toHaveProperty("cc")
    deliveryMocks.rpc.mockResolvedValue({ data: null, error: { code: "08006" } })
    deliveryMocks.rpc.mockClear()
    await expect(dispatchFiscalStaffEmails()).rejects.toThrow("queue unavailable")
    expect(deliveryMocks.rpc).toHaveBeenCalledTimes(1)
  })
  it("records delivery failure for retry without marking it sent", async () => {
    deliveryMocks.send.mockRejectedValue(new Error("network error"))
    expect(await dispatchFiscalStaffEmails()).toEqual({ sent: 0, failed: 1 })
    expect(deliveryMocks.rpc).toHaveBeenLastCalledWith("finish_fiscal_staff_email", expect.objectContaining({ p_success: false, p_message_id: null }))
  })
  it("does not claim success when acknowledgement fails", async () => {
    deliveryMocks.rpc.mockResolvedValueOnce({ data: [notificationJob], error: null }).mockResolvedValueOnce({ data: false, error: null })
    await expect(dispatchFiscalStaffEmails()).rejects.toThrow("could not be recorded")
  })
})
