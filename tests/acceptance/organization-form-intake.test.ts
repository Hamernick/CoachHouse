import { beforeEach, describe, expect, it, vi } from "vitest"
import { createFormVersion } from "@/features/organization-forms"
import { runFormIntake } from "@/features/organization-forms/server/intake-service"
import { handleFormIntake } from "@/features/organization-forms/server/intake-route"
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), auth: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ rpc: mocks.rpc }) }))
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ auth: { getUser: mocks.auth } }) }))
vi.mock("@/lib/feature-flags", () => ({ publicSharingEnabled: true }))
const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const version = createFormVersion({ id: id(80), formId: id(20), revision: 1, title: "Sign up", description: "",
  definition: { questions: [{ id: id(90), type: "text", label: "Name", required: true }] } })
const submission = { id: id(91), formId: id(20), versionId: id(80), answers: [{ questionId: id(90), value: "Joan" }] }
const command = { action: "submit" as const, audience: "public" as const, submission }
const receipt = { id: id(91), versionId: id(80), submittedAt: "2026-11-01T12:00:00Z" }
const response = { ...receipt, updatedAt: receipt.submittedAt, revision: 2, answers: [{ questionId: id(90), value: "Joanne" }] }
beforeEach(() => { vi.resetAllMocks(); mocks.auth.mockResolvedValue({ data: { user: { id: id(1) } }, error: null }) })
describe("native form intake boundaries", () => {
  it("validates the canonical version and binds the write and immutable retry hash", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: version }).mockResolvedValueOnce({ data: receipt })
    expect(await runFormIntake(null, command)).toEqual(receipt)
    const write = mocks.rpc.mock.calls[1][1]
    expect(write.p_actor_id).toBeNull()
    expect(write.p_command).toMatchObject({ action: "submit", version, answers: submission.answers, versionId: version.id })
    expect(write.p_command.hash).toMatch(/^[a-f0-9]{64}$/)
  })
  it.each([
    { ...submission, formId: id(21) },
    { ...submission, answers: [{ questionId: id(99), value: "no" }] },
    { ...submission, answers: [] },
  ])("rejects invalid answers before writing", async (input) => {
    mocks.rpc.mockResolvedValue({ data: version })
    await expect(runFormIntake(null, { ...command, submission: input })).rejects.toMatchObject({ status: 400 })
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
  })
  it("corrects only a selected answer using the caller revision and operation identity", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: version }).mockResolvedValueOnce({ data: response }).mockResolvedValueOnce({ data: { ...response, revision: 3 } })
    await runFormIntake(id(1), { action: "correct", id: id(91), versionId: id(80), expectedRevision: 2, operationId: id(92), questionId: id(90), value: "Joanne" })
    expect(mocks.rpc.mock.calls[2][1].p_command).toMatchObject({ action: "correct", expectedRevision: 2, operationId: id(92), answers: response.answers })
  })
  it.each([["42501",403,false],["40001",409,false],["23505",409,false],["54000",429,false],["network",503,true]])("maps %s without leaking provider details", async (code,status,uncertain) => {
    mocks.rpc.mockResolvedValueOnce({ data: version }).mockResolvedValueOnce({ error: { code, message: "private answer" } })
    await expect(runFormIntake(null, command)).rejects.toMatchObject({ status, uncertain })
  })
  it("blocks cross-origin and oversized bodies before database work", async () => {
    const cross = await handleFormIntake(new Request("https://example.org/api/public/forms/intake", { method: "POST", headers: { origin: "https://elsewhere.org", "content-type": "application/json" }, body: JSON.stringify(command) }))
    expect(cross.status).toBe(403)
    const large = await handleFormIntake(new Request("https://example.org/api/public/forms/intake", { method: "POST", headers: { origin: "https://example.org", "content-type": "application/json" }, body: "x".repeat(262145) }))
    expect(large.status).toBe(413); expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it("does not accept a valid JSON prefix when the request stream times out", async () => {
    vi.useFakeTimers()
    try {
      const stream = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(JSON.stringify(command))) } })
      const request = new Request("https://example.org/api/public/forms/intake", { method: "POST", headers: { origin: "https://example.org", "content-type": "application/json" }, body: stream, duplex: "half" } as RequestInit)
      const result = handleFormIntake(request)
      await vi.advanceTimersByTimeAsync(10_000)
      expect((await result).status).toBe(408); expect(mocks.rpc).not.toHaveBeenCalled()
    } finally { vi.useRealTimers() }
  })
  it("requires an actual session for response reads", async () => {
    mocks.auth.mockResolvedValue({ data: { user: null }, error: null })
    const result = await handleFormIntake(new Request("https://example.org/api/public/forms/intake", { method: "POST", headers: { origin: "https://example.org", "content-type": "application/json" }, body: JSON.stringify({ action: "responses", versionId: id(80) }) }))
    expect(result.status).toBe(401); expect(mocks.rpc).not.toHaveBeenCalled()
    expect(result.headers.get("cache-control")).toContain("no-store")
  })
})

const recovery = { action: "recover_form" as const, pageId: id(10), formId: id(20), operationId: id(150), expectedRevision: 1 }
describe("form recovery HTTP boundary", () => {
  it("uses the verified session and returns only a typed recovery receipt", async () => {
    mocks.rpc.mockResolvedValue({ data: { formId: id(20), operationId: id(150), revision: 2 } })
    const result = await handleFormIntake(new Request("https://example.org/api/public/forms/intake", { method: "POST", headers: { origin: "https://example.org", "content-type": "application/json" }, body: JSON.stringify(recovery) }))
    expect(result.status).toBe(200)
    expect(mocks.rpc).toHaveBeenCalledWith("organization_form_recovery", { p_actor_id: id(1), p_command: recovery })
    expect(result.headers.get("cache-control")).toContain("no-store")
  })
  it("rejects caller-provided identities and unauthenticated recovery", async () => {
    const request = (command: unknown) => new Request("https://example.org/api/public/forms/intake", { method: "POST", headers: { origin: "https://example.org", "content-type": "application/json" }, body: JSON.stringify(command) })
    expect((await handleFormIntake(request({ ...recovery, actorId: id(2) }))).status).toBe(400)
    mocks.auth.mockResolvedValue({ data: { user: null }, error: null })
    expect((await handleFormIntake(request(recovery))).status).toBe(401)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it.each([["42501",403,false],["40001",409,false],["23505",409,false],["network",503,true]])("handles %s recovery without exposing source details", async (code,status,uncertain) => {
    mocks.rpc.mockResolvedValue({ error: { code, message: "private source" } })
    await expect(runFormIntake(id(1), recovery)).rejects.toMatchObject({ status, uncertain })
  })
  it("does not mistake an invalid write receipt for a confirmed recovery", async () => {
    mocks.rpc.mockResolvedValue({ data: { success: true } })
    const result = await handleFormIntake(new Request("https://example.org/api/public/forms/intake", { method: "POST", headers: { origin: "https://example.org", "content-type": "application/json" }, body: JSON.stringify(recovery) }))
    expect(result.status).toBe(503)
    expect(await result.json()).toMatchObject({ uncertain: true })
  })
})

const request = (command: unknown) => new Request("https://example.org/api/public/forms/intake", { method: "POST", headers: { origin: "https://example.org", "content-type": "application/json" }, body: JSON.stringify(command) })
const grantReview = { action: "grant_reviewer" as const, versionId: id(80), email: "person4@example.org", operationId: id(180), expectedRevision: 1 }
describe("scoped review access boundary", () => {
  it("uses session authority and validates the canonical access receipt", async () => {
    mocks.rpc.mockResolvedValue({ data: { formId: id(20), operationId: id(180), revision: 2 } })
    const result = await handleFormIntake(request(grantReview))
    expect(result.status).toBe(200)
    expect(mocks.rpc).toHaveBeenCalledWith("organization_form_review_access", { p_actor_id: id(1), p_command: grantReview })
    expect(result.headers.get("cache-control")).toContain("no-store")
  })
  it("rejects caller identities and anonymous access changes", async () => {
    expect((await handleFormIntake(request({ ...grantReview, actorId: id(2) }))).status).toBe(400)
    mocks.auth.mockResolvedValue({ data: { user: null }, error: null })
    expect((await handleFormIntake(request(grantReview))).status).toBe(401)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it.each([["42501",403,false],["40001",409,false],["23505",409,false],["network",503,true]])("maps %s without private details", async (code,status,uncertain) => {
    mocks.rpc.mockResolvedValue({ error: { code, message: "private email" } })
    await expect(runFormIntake(id(1), grantReview)).rejects.toMatchObject({ status, uncertain })
  })
  it("keeps malformed access receipts uncertain", async () => {
    mocks.rpc.mockResolvedValue({ data: { success: true } })
    const result = await handleFormIntake(request(grantReview))
    expect(result.status).toBe(503)
    expect(await result.json()).toMatchObject({ uncertain: true })
  })
  it("requires explicit response capabilities rather than guessing from organization role", async () => {
    mocks.rpc.mockResolvedValue({ data: { version, responses: [response], next: null } })
    expect((await handleFormIntake(request({ action: "responses", versionId: id(80) }))).status).toBe(503)
    mocks.rpc.mockResolvedValue({ data: { version, permissions: { canCorrect: false, canManageAccess: false }, responses: [response], next: null } })
    const result = await handleFormIntake(request({ action: "responses", versionId: id(80) }))
    expect(result.status).toBe(200)
    expect(await result.json()).toMatchObject({ value: { permissions: { canCorrect: false, canManageAccess: false } } })
  })
})

describe("form editor access boundary", () => {
  it("accepts bounded Edit grants and preserves the verified actor", async () => {
    mocks.rpc.mockResolvedValue({ data: { formId: id(20), operationId: id(180), revision: 2 } })
    const result = await handleFormIntake(request({ ...grantReview, role: "edit" }))
    expect(result.status).toBe(200)
    expect(mocks.rpc.mock.calls[0][1]).toMatchObject({ p_actor_id: id(1), p_command: { role: "edit" } })
  })
  it("rejects unsupported roles or caller-supplied capabilities before dispatch", async () => {
    expect((await handleFormIntake(request({ ...grantReview, role: "owner" }))).status).toBe(400)
    expect((await handleFormIntake(request({ action: "source_access", organizationId: id(1), formId: id(20), canEdit: true }))).status).toBe(400)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it("reads a typed source capability without requesting private responses", async () => {
    const command = { action: "source_access" as const, organizationId: id(1), formId: id(20) }
    mocks.rpc.mockResolvedValue({ data: { formId: id(20), canEdit: false, canManageAccess: false } })
    expect(await runFormIntake(id(4), command)).toEqual({ formId: id(20), canEdit: false, canManageAccess: false })
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("organization_form_review_access", { p_actor_id: id(4), p_command: command })
    mocks.rpc.mockResolvedValue({ data: { formId: id(20) } })
    const result = await handleFormIntake(request(command))
    expect(result.status).toBe(503); expect(await result.json()).toMatchObject({ uncertain: false })
  })
})

describe("form Manage access boundary", () => {
  it("passes typed Manage to server authorization without accepting client authority", async () => {
    mocks.rpc.mockResolvedValue({ data: { formId: id(20), operationId: id(180), revision: 2 } })
    expect((await handleFormIntake(request({ ...grantReview, role: "manage" }))).status).toBe(200)
    expect(mocks.rpc).toHaveBeenCalledWith("organization_form_review_access", { p_actor_id: id(1), p_command: { ...grantReview, role: "manage" } })
    expect((await handleFormIntake(request({ ...grantReview, role: "manage", canGrantManage: true }))).status).toBe(400)
  })
  it("requires explicit delegation capability on roster reads", async () => {
    const command = { action: "review_access" as const, versionId: id(80) }
    mocks.rpc.mockResolvedValue({ data: { formId: id(20), revision: 1, reviewers: [] } })
    expect((await handleFormIntake(request(command))).status).toBe(503)
    mocks.rpc.mockResolvedValue({ data: { formId: id(20), revision: 1, canGrantManage: false, reviewers: [] } })
    const result = await handleFormIntake(request(command))
    expect(result.status).toBe(200)
    expect(await result.json()).toMatchObject({ value: { canGrantManage: false } })
  })
})


describe("saved-form access targets", () => {
  const target = { organizationId: id(1), formId: id(20) }
  it("manages a canonical form without any published version", async () => {
    const command = { action: "grant_reviewer" as const, ...target, email: "person4@example.org", role: "edit", operationId: id(180), expectedRevision: 1 }
    mocks.rpc.mockResolvedValue({ data: { formId: id(20), operationId: id(180), revision: 2 } })
    expect((await handleFormIntake(request(command))).status).toBe(200)
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("organization_form_review_access", { p_actor_id: id(1), p_command: command })
  })
  it.each([
    { action: "review_access" },
    { action: "review_access", organizationId: id(1) },
    { action: "review_access", formId: id(20) },
    { action: "review_access", ...target, versionId: id(80) },
    { ...grantReview, ...target },
    { action: "revoke_reviewer", ...target, versionId: id(80), memberId: id(4), operationId: id(180), expectedRevision: 1 },
  ])("rejects missing, partial or ambiguous targets before dispatch", async (command) => {
    expect((await handleFormIntake(request(command))).status).toBe(400)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it("fails closed when source management capability is missing", async () => {
    mocks.rpc.mockResolvedValue({ data: { formId: id(20), canEdit: true } })
    expect((await handleFormIntake(request({ action: "source_access", ...target }))).status).toBe(503)
  })
})

describe("saved source recovery target", () => {
  const request = (body: unknown) => new Request("https://example.org/api/public/forms/intake", { method: "POST", headers: { origin: "https://example.org", "content-type": "application/json" }, body: JSON.stringify(body) })
  const source = { action: "recover_form", organizationId: id(1), formId: id(20), operationId: id(151), expectedRevision: 1 }
  it("dispatches canonical recovery using the session without a page", async () => {
    mocks.rpc.mockResolvedValue({ data: { formId: id(20), operationId: id(151), revision: 2 } })
    expect((await handleFormIntake(request(source))).status).toBe(200)
    expect(mocks.rpc).toHaveBeenCalledWith("organization_form_recovery", { p_actor_id: id(1), p_command: source })
  })
  it.each([
    { ...source, pageId: id(10) }, { ...source, organizationId: undefined },
    { action: "recoverable_forms", organizationId: id(1) },
    { action: "recoverable_forms", formId: id(20) },
    { action: "recoverable_forms", organizationId: id(1), formId: id(20), pageId: id(10) },
  ])("rejects missing or ambiguous recovery targets", async command => {
    expect((await handleFormIntake(request(command))).status).toBe(400)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
})

const inviteViewer = { action: "invite_viewer" as const, versionId: id(80), email: "guest@example.org", expectedRevision: 1, operationId: id(600) }
describe("identity-bound viewer invitations", () => {
  it("binds invitations to the verified session and private typed receipt", async () => {
    mocks.rpc.mockResolvedValue({ data: { formId: id(20), invitationId: id(600), operationId: id(600), revision: 2 } })
    const result = await handleFormIntake(request(inviteViewer))
    expect(result.status).toBe(200)
    expect(mocks.rpc).toHaveBeenCalledWith("organization_form_viewer_access", { p_actor_id: id(1), p_command: inviteViewer })
    expect(result.headers.get("cache-control")).toContain("no-store")
  })
  it("rejects anonymous invitations and caller-controlled access levels", async () => {
    expect((await handleFormIntake(request({ ...inviteViewer, role: "edit" }))).status).toBe(400)
    expect((await handleFormIntake(request({ ...inviteViewer, actorId: id(2) }))).status).toBe(400)
    mocks.auth.mockResolvedValue({ data: { user: null }, error: null })
    expect((await handleFormIntake(request(inviteViewer))).status).toBe(401)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it.each([["42501",403,false],["40001",409,false],["23505",409,false],["22023",400,false],["54000",400,false],["network",503,true]])("maps invitation %s without leaking email or data", async (code,status,uncertain) => {
    mocks.rpc.mockResolvedValue({ error: { code, message: "private email and answers" } })
    await expect(runFormIntake(id(1), inviteViewer)).rejects.toMatchObject({ status, uncertain })
    const result = await handleFormIntake(request(inviteViewer))
    expect(await result.text()).not.toContain("private email")
  })
  it.each(["invite_viewer", "revoke_viewer", "accept_viewer"] as const)("treats malformed %s receipts as uncertain", async (action) => {
    mocks.rpc.mockResolvedValue({ data: { ok: true } })
    const command = action === "invite_viewer" ? inviteViewer : action === "accept_viewer"
      ? { action, versionId: id(80), invitationId: id(600) }
      : { action, versionId: id(80), invitationId: id(600), operationId: id(601), expectedRevision: 2 }
    const result = await handleFormIntake(request(command))
    expect(result.status).toBe(503); expect(await result.json()).toMatchObject({ uncertain: true })
  })
  it("accepts only a typed identity-bound acceptance receipt", async () => {
    const command = { action: "accept_viewer" as const, versionId: id(80), invitationId: id(600) }
    const receipt = { versionId: id(80), invitationId: id(600), accepted: true }
    mocks.rpc.mockResolvedValue({ data: receipt })
    expect(await runFormIntake(id(2), command)).toEqual(receipt)
    expect(mocks.rpc).toHaveBeenCalledWith("organization_form_viewer_access", { p_actor_id: id(2), p_command: command })
  })
})


describe("form-scoped version navigation", () => {
  const command = { action: "response_versions" as const, versionId: id(80), before: id(81) }
  const request = (value: unknown) => new Request("https://example.org/api/public/forms/intake", { method: "POST", headers: { origin: "https://example.org", "content-type": "application/json" }, body: JSON.stringify(value) })
  it("binds a typed private read to the session and exact locator", async () => {
    const value = { versions: [{ id: id(80), title: "Sign up", revision: 1, createdAt: "2026-11-01T12:00:00Z" }], next: null }
    mocks.rpc.mockResolvedValue({ data: value })
    const result = await handleFormIntake(request(command))
    expect(result.status).toBe(200); expect(await result.json()).toEqual({ value })
    expect(mocks.rpc).toHaveBeenCalledWith("list_organization_form_response_versions", { p_actor_id: id(1), p_version_id: id(80), p_before: id(81) })
    expect(result.headers.get("cache-control")).toContain("no-store")
  })
  it("rejects anonymous reads, malformed cursors and client authority", async () => {
    expect((await handleFormIntake(request({ ...command, actorId: id(2) }))).status).toBe(400)
    expect((await handleFormIntake(request({ ...command, before: "wrong" }))).status).toBe(400)
    mocks.auth.mockResolvedValue({ data: { user: null }, error: null })
    expect((await handleFormIntake(request(command))).status).toBe(401)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it.each([["42501", 403], ["22023", 400], ["network", 503]])("keeps %s read errors private and retryable without write uncertainty", async (code, status) => {
    mocks.rpc.mockResolvedValue({ error: { code, message: "Private form title" } })
    const result = await handleFormIntake(request(command))
    expect(result.status).toBe(status)
    expect(await result.json()).toEqual({ error: "Unable to load form versions.", uncertain: false })
  })
  it("rejects unexpected private fields in a version summary", async () => {
    mocks.rpc.mockResolvedValue({ data: { versions: [{ id: id(80), title: "Sign up", revision: 1, createdAt: "2026-11-01T12:00:00Z", answers: ["Private"] }], next: null } })
    const result = await handleFormIntake(request(command))
    expect(result.status).toBe(503); expect(JSON.stringify(await result.json())).not.toContain("Private")
  })
})

describe("invited response correction contracts", () => {
  it("passes only the chosen response capability with the session actor", async () => {
    const command = { ...inviteViewer, responsePermission: "correct" as const }
    mocks.rpc.mockResolvedValue({ data: { formId: id(20), invitationId: id(600), operationId: id(600), revision: 2 } })
    expect((await handleFormIntake(request(command))).status).toBe(200)
    expect(mocks.rpc).toHaveBeenCalledWith("organization_form_viewer_access", { p_actor_id: id(1), p_command: command })
  })
  it.each(["owner", "admin", null, true])("rejects unsupported permission %s before dispatch", async responsePermission => {
    expect((await handleFormIntake(request({ ...inviteViewer, responsePermission }))).status).toBe(400)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it("discloses the accepted scope and treats missing legacy scope as read-only", async () => {
    const offer = { invitationId: id(600), versionId: id(80), title: "Form", accepted: false, expiresAt: "2026-12-01T00:00:00Z" }
    mocks.rpc.mockResolvedValue({ data: { ...offer, responsePermission: "correct" } })
    expect(await runFormIntake(id(2), { action: "viewer_offer", versionId: id(80) })).toEqual({ ...offer, responsePermission: "correct" })
    mocks.rpc.mockResolvedValue({ data: offer })
    expect(await runFormIntake(id(2), { action: "viewer_offer", versionId: id(80) })).toEqual({ ...offer, responsePermission: "view" })
    mocks.rpc.mockResolvedValue({ data: { ...offer, responsePermission: "admin" } })
    expect((await handleFormIntake(request({ action: "viewer_offer", versionId: id(80) }))).status).toBe(503)
  })
})


describe("accessible form directory", () => {
  const command = { action: "response_forms" as const, versionId: id(80), after: id(20) }
  const directory = { forms: [{ formId: id(21), versionId: id(81), title: "Volunteer interest" }], next: null }
  const request = (value: unknown) => new Request("https://example.org/api/public/forms/intake", { method: "POST", headers: { origin: "https://example.org", "content-type": "application/json" }, body: JSON.stringify(value) })
  it("binds discovery to the session and validates minimal bounded results", async () => {
    mocks.rpc.mockResolvedValue({ data: directory })
    const result = await handleFormIntake(request(command))
    expect(result.status).toBe(200); expect(await result.json()).toEqual({ value: directory })
    expect(result.headers.get("cache-control")).toContain("no-store")
    expect(mocks.rpc).toHaveBeenCalledWith("list_accessible_organization_forms", { p_actor_id: id(1), p_version_id: id(80), p_after: id(20) })
  })
  it("rejects caller authority and unauthenticated discovery", async () => {
    expect((await handleFormIntake(request({ ...command, actorId: id(2) }))).status).toBe(400)
    mocks.auth.mockResolvedValue({ data: { user: null } })
    expect((await handleFormIntake(request(command))).status).toBe(401)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it.each([
    { ...directory, forms: Array.from({ length: 51 }, () => directory.forms[0]) },
    { ...directory, forms: [{ ...directory.forms[0], answers: ["private"] }] },
    { ...directory, forms: [{ ...directory.forms[0], versionId: "https://evil.example" }] },
  ])("rejects malformed or overbroad RPC output", async (data) => {
    mocks.rpc.mockResolvedValue({ data })
    const result = await handleFormIntake(request(command))
    expect(result.status).toBe(503); expect(await result.text()).not.toContain("private")
  })
  it.each([["42501", 403], ["network", 503]])("maps %s without leaking provider data", async (code, status) => {
    mocks.rpc.mockResolvedValue({ error: { code, message: "secret form" } })
    const result = await handleFormIntake(request(command))
    expect(result.status).toBe(status); expect(await result.text()).not.toContain("secret form")
  })
})

describe("isolated form source authoring", () => {
  const source = { formId: id(20), revision: "a".repeat(64), title: "Sign up", description: "", definition: { questions: [{ id: id(90), type: "text", label: "Name", required: true }] } }
  const content = { title: source.title, description: source.description, definition: source.definition }
  const save = { action: "save_form_source" as const, versionId: id(80), operationId: id(710), expectedRevision: source.revision, content }
  const request = (body: unknown) => new Request("https://example.org/api/public/forms/intake", { method: "POST", headers: { origin: "https://example.org", "content-type": "application/json" }, body: JSON.stringify(body) })
  it.each(["response_forms", "viewer_offer"] as const)("preserves the canonical 240-character title in %s", async (action) => {
    const title = "x".repeat(240)
    mocks.rpc.mockResolvedValue({ data: action === "response_forms" ? { forms: [{ formId: id(20), versionId: id(80), title }], next: null }
      : { invitationId: id(700), versionId: id(80), title, accepted: false, expiresAt: "2026-12-01T00:00:00Z", responsePermission: "edit" } })
    expect((await handleFormIntake(request({ action, versionId: id(80) }))).status).toBe(200)
  })
  it("reads only a typed form projection using the session identity", async () => {
    mocks.rpc.mockResolvedValue({ data: source })
    const result = await handleFormIntake(request({ action: "read_form_source", versionId: id(80) }))
    expect(result.status).toBe(200); expect(result.headers.get("cache-control")).toContain("no-store")
    expect(await result.json()).toEqual({ value: source })
    expect(mocks.rpc).toHaveBeenCalledWith("organization_form_source_command", { p_actor_id: id(1), p_command: { action: "read_form_source", versionId: id(80) } })
  })
  it("writes only validated content with exact revision and operation identity", async () => {
    const receipt = { formId: id(20), operationId: id(710), revision: "b".repeat(64) }
    mocks.rpc.mockResolvedValue({ data: receipt })
    expect((await handleFormIntake(request(save))).status).toBe(200)
    expect(mocks.rpc).toHaveBeenCalledWith("organization_form_source_command", { p_actor_id: id(1), p_command: save })
  })
  it.each([
    { ...save, actorId: id(2) }, { ...save, board: {} },
    { ...save, content: { ...content, title: "   " } },
    { ...save, content: { ...content, title: "x".repeat(241) } },
    { ...save, content: { ...content, formId: id(21) } },
    { ...save, content: { ...content, definition: { questions: [{ ...content.definition.questions[0], type: "file" }] } } },
    { ...save, content: { ...content, definition: { questions: [content.definition.questions[0], content.definition.questions[0]] } } },
  ])("rejects unauthorized shape before the writer", async (command) => {
    expect((await handleFormIntake(request(command))).status).toBe(400); expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it("does not allow anonymous source access", async () => {
    mocks.auth.mockResolvedValue({ data: { user: null } })
    expect((await handleFormIntake(request(save))).status).toBe(401); expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it.each([["42501",403,false],["40001",409,false],["23505",409,false],["22023",400,false],["network",503,true]])("maps source error %s without disclosing database details", async (code,status,uncertain) => {
    mocks.rpc.mockResolvedValue({ error: { code, message: "Private graph" } })
    const result = await handleFormIntake(request(save))
    expect(result.status).toBe(status)
    const body = await result.json(); expect(body.uncertain).toBe(uncertain); expect(JSON.stringify(body)).not.toContain("Private graph")
  })
  it("treats invalid success acknowledgements as uncertain and rejects extra source data", async () => {
    mocks.rpc.mockResolvedValue({ data: { ...source, privateGraph: {} } })
    expect((await handleFormIntake(request({ action: "read_form_source", versionId: id(80) }))).status).toBe(503)
    mocks.rpc.mockResolvedValue({ data: { success: true } })
    expect(await (await handleFormIntake(request(save))).json()).toMatchObject({ uncertain: true })
  })
  it("accepts explicit Edit only as an invitation requiring acceptance", async () => {
    mocks.rpc.mockResolvedValue({ data: { formId: id(20), invitationId: id(700), operationId: id(700), revision: 2 } })
    const command = { action: "invite_viewer", versionId: id(80), operationId: id(700), expectedRevision: 1, email: "guest@example.org", responsePermission: "edit" }
    expect((await handleFormIntake(request(command))).status).toBe(200)
    expect(mocks.rpc).toHaveBeenCalledWith("organization_form_viewer_access", { p_actor_id: id(1), p_command: command })
  })
})


describe("invited form management contracts", () => {
  it("binds Manage invitations to the session and rejects injected delegation authority", async () => {
    const command = { ...inviteViewer, responsePermission: "manage" }
    mocks.rpc.mockResolvedValue({ data: { formId: id(20), invitationId: id(600), operationId: id(600), revision: 2 } })
    expect((await handleFormIntake(request(command))).status).toBe(200)
    expect(mocks.rpc).toHaveBeenCalledWith("organization_form_viewer_access", { p_actor_id: id(1), p_command: command })
    for (const injected of [{ parentInvitationId: id(601) }, { canGrantManage: true }, { invitedBy: id(2) }]) {
      mocks.rpc.mockClear()
      expect((await handleFormIntake(request({ ...command, ...injected }))).status).toBe(400)
      expect(mocks.rpc).not.toHaveBeenCalled()
    }
  })
  it("returns only server-qualified invitation management and defaults legacy capabilities closed", async () => {
    const command = { action: "viewer_invitations" as const, versionId: id(80) }
    mocks.rpc.mockResolvedValue({ data: { formId: id(20), revision: 1, invitations: [] } })
    expect(await runFormIntake(id(2), command)).toMatchObject({ canGrantManage: false })
    mocks.rpc.mockResolvedValue({ data: { formId: id(20), revision: 1, canGrantManage: true, invitations: [] } })
    expect(await runFormIntake(id(1), command)).toMatchObject({ canGrantManage: true })
    mocks.rpc.mockResolvedValue({ data: { version, permissions: { canCorrect: true, canEditDefinition: true, canManageAccess: false, canManageInvitations: true }, responses: [], next: null } })
    expect(await runFormIntake(id(2), { action: "responses", versionId: id(80) })).toMatchObject({ permissions: { canManageAccess: false, canManageInvitations: true } })
  })
})

describe("scale intake and correction use the stored version bounds", () => {
  const scaleVersion = createFormVersion({ id: id(80), formId: id(20), revision: 1, title: "Feedback", description: "", definition: { questions: [
    { id: id(90), type: "linear_scale", label: "Confidence", required: true, min: 0, max: 5, lowerLabel: "Low", upperLabel: "High" },
    { id: id(95), type: "rating", label: "Rating", required: false, min: 1, max: 10, lowerLabel: "", upperLabel: "" },
  ] } })
  it("submits numeric answers and corrects one cell without replacing another answer", async () => {
    const answers = [{ questionId: id(90), value: 0 }, { questionId: id(95), value: 10 }]
    mocks.rpc.mockResolvedValueOnce({ data: scaleVersion }).mockResolvedValueOnce({ data: receipt })
    await runFormIntake(null, { ...command, submission: { ...submission, answers } })
    expect(mocks.rpc.mock.calls[1][1].p_command.answers).toEqual(answers)
    mocks.rpc.mockReset()
    const saved = { ...response, answers }
    const corrected = [{ questionId: id(90), value: 5 }, answers[1]]
    mocks.rpc.mockResolvedValueOnce({ data: scaleVersion }).mockResolvedValueOnce({ data: saved }).mockResolvedValueOnce({ data: { ...saved, revision: 3, answers: corrected } })
    expect(await runFormIntake(id(1), { action: "correct", id: id(91), versionId: id(80), expectedRevision: 2, operationId: id(92), questionId: id(90), value: 5 })).toMatchObject({ revision: 3, answers: corrected })
    expect(mocks.rpc.mock.calls[2][1].p_command).toMatchObject({ expectedRevision: 2, answers: corrected })
  })
  it.each([6, -1, 1.5, "3"])("rejects out-of-version or wrong-type value %j before write", async value => {
    mocks.rpc.mockResolvedValue({ data: scaleVersion })
    await expect(runFormIntake(null, { ...command, submission: { ...submission, answers: [{ questionId: id(90), value }] } })).rejects.toMatchObject({ status: 400 })
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
    mocks.rpc.mockReset()
    mocks.rpc.mockResolvedValueOnce({ data: scaleVersion }).mockResolvedValueOnce({ data: { ...response, answers: [{ questionId: id(90), value: 0 }] } })
    await expect(runFormIntake(id(1), { action: "correct", id: id(91), versionId: id(80), expectedRevision: 2, operationId: id(92), questionId: id(90), value })).rejects.toMatchObject({ status: 400 })
    expect(mocks.rpc).toHaveBeenCalledTimes(2)
  })
})

describe("grid intake and correction", () => {
  const gridVersion = createFormVersion({ ...version, definition: { questions: [
    { id: id(90), type: "multiple_choice_grid", label: "Availability", required: true,
      rows: [{ id: id(100), label: "Monday" }, { id: id(101), label: "Tuesday" }], columns: [{ id: id(110), label: "Morning" }, { id: id(111), label: "Afternoon" }] },
    { id: id(95), type: "text", label: "Name", required: false },
  ] } })
  const value = { [id(100)]: id(110), [id(101)]: id(111) }
  const answers = [{ questionId: id(90), value }, { questionId: id(95), value: "Joan" }]
  it("validates stored grid membership before submitting and preserves other cells during correction", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: gridVersion }).mockResolvedValueOnce({ data: receipt })
    await runFormIntake(null, { ...command, submission: { ...submission, answers } })
    expect(mocks.rpc.mock.calls[1][1].p_command.answers).toEqual(answers)
    mocks.rpc.mockReset()
    const next = { ...value, [id(100)]: id(111) }
    const corrected = [{ questionId: id(90), value: next }, answers[1]]
    mocks.rpc.mockResolvedValueOnce({ data: gridVersion }).mockResolvedValueOnce({ data: { ...response, answers } }).mockResolvedValueOnce({ data: { ...response, revision: 3, answers: corrected } })
    expect(await runFormIntake(id(1), { action: "correct", id: id(91), versionId: id(80), expectedRevision: 2, operationId: id(92), questionId: id(90), value: next })).toMatchObject({ revision: 3, answers: corrected })
    expect(mocks.rpc.mock.calls[2][1].p_command).toMatchObject({ expectedRevision: 2, answers: corrected })
  })
  it.each([{}, { [id(100)]: id(110) }, { ...value, [id(101)]: id(999) }, { ...value, [id(100)]: [id(110)] }])("blocks invalid grid %j before canonical write", async invalid => {
    mocks.rpc.mockResolvedValue({ data: gridVersion })
    await expect(runFormIntake(null, { ...command, submission: { ...submission, answers: [{ questionId: id(90), value: invalid }] } })).rejects.toMatchObject({ status: 400 })
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
    mocks.rpc.mockReset()
    mocks.rpc.mockResolvedValueOnce({ data: gridVersion }).mockResolvedValueOnce({ data: { ...response, answers } })
    await expect(runFormIntake(id(1), { action: "correct", id: id(91), versionId: id(80), expectedRevision: 2, operationId: id(92), questionId: id(90), value: invalid })).rejects.toMatchObject({ status: 400 })
    expect(mocks.rpc).toHaveBeenCalledTimes(2)
  })
})

describe("Other intake and staff correction", () => {
  const otherVersion = createFormVersion({ ...version, definition: { questions: [
    { id: id(90), type: "multiple_choice", label: "Location", required: true, options: ["North", "South"], allowOther: true },
    { id: id(95), type: "text", label: "Name", required: false },
  ] } })
  const value = { optionIds: ["option-1", "other"], otherText: "East" }
  const answers = [{ questionId: id(90), value }, { questionId: id(95), value: "Joan" }]
  it("submits structured answers and corrects the chosen field without changing other answers", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: otherVersion }).mockResolvedValueOnce({ data: receipt })
    await runFormIntake(null, { ...command, submission: { ...submission, answers } })
    expect(mocks.rpc.mock.calls[1][1].p_command.answers).toEqual(answers)
    mocks.rpc.mockReset()
    const next = { optionIds: ["other"], otherText: "West" }
    const corrected = [{ questionId: id(90), value: next }, answers[1]]
    mocks.rpc.mockResolvedValueOnce({ data: otherVersion }).mockResolvedValueOnce({ data: { ...response, answers } }).mockResolvedValueOnce({ data: { ...response, revision: 3, answers: corrected } })
    expect(await runFormIntake(id(1), { action: "correct", id: id(91), versionId: id(80), expectedRevision: 2, operationId: id(92), questionId: id(90), value: next })).toMatchObject({ revision: 3, answers: corrected })
    expect(mocks.rpc.mock.calls[2][1].p_command).toMatchObject({ expectedRevision: 2, answers: corrected })
  })
  it.each([
    { optionIds: ["other"], otherText: " " },
    { optionIds: ["other", "option-3"], otherText: "East" },
    { optionIds: ["option-1"], otherText: "Hidden" },
    { optionIds: ["other", "other"], otherText: "East" },
  ])("rejects malformed Other %j before either writer", async invalid => {
    mocks.rpc.mockResolvedValue({ data: otherVersion })
    await expect(runFormIntake(null, { ...command, submission: { ...submission, answers: [{ questionId: id(90), value: invalid }] } })).rejects.toMatchObject({ status: 400 })
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
    mocks.rpc.mockReset()
    mocks.rpc.mockResolvedValueOnce({ data: otherVersion }).mockResolvedValueOnce({ data: { ...response, answers } })
    await expect(runFormIntake(id(1), { action: "correct", id: id(91), versionId: id(80), expectedRevision: 2, operationId: id(92), questionId: id(90), value: invalid })).rejects.toMatchObject({ status: 400 })
    expect(mocks.rpc).toHaveBeenCalledTimes(2)
  })
  it("rejects Other against the published version when only the newer draft would enable it", async () => {
    const disabled = { ...otherVersion, definition: { questions: otherVersion.definition.questions.map(q => q.type === "multiple_choice" ? { ...q, allowOther: false } : q) } }
    mocks.rpc.mockResolvedValue({ data: disabled })
    await expect(runFormIntake(null, { ...command, submission: { ...submission, answers } })).rejects.toMatchObject({ status: 400 })
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
  })
})

const deletion = { action: "delete_response" as const, versionId: id(80), id: id(91), operationId: id(500), expectedRevision: 2 }
const deletedReceipt = { id: id(91), versionId: id(80), operationId: id(500), deletedAt: "2026-11-01T12:00:00Z" }
describe("native response deletion boundary", () => {
  it("uses the verified actor and returns an answer-free exact receipt without reading answers", async () => {
    mocks.rpc.mockResolvedValue({ data: deletedReceipt })
    const result = await handleFormIntake(request(deletion))
    expect(result.status).toBe(200)
    expect(await result.json()).toEqual({ value: deletedReceipt })
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("organization_form_intake", { p_actor_id: id(1), p_command: deletion })
    expect(result.headers.get("cache-control")).toContain("no-store")
  })
  it("rejects caller identity and anonymous deletion before dispatch", async () => {
    expect((await handleFormIntake(request({ ...deletion, actorId: id(2) }))).status).toBe(400)
    mocks.auth.mockResolvedValue({ data: { user: null }, error: null })
    expect((await handleFormIntake(request(deletion))).status).toBe(401)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it.each([
    { ...deletedReceipt, id: id(92) }, { ...deletedReceipt, operationId: id(501) },
    { ...deletedReceipt, versionId: id(81) }, { ...deletedReceipt, answers: [] },
  ])("treats malformed or mismatched receipts as uncertain", async (receipt) => {
    mocks.rpc.mockResolvedValue({ data: receipt })
    const result = await handleFormIntake(request(deletion))
    expect(result.status).toBe(503); expect(await result.json()).toMatchObject({ uncertain: true })
  })
  it.each([["42501",403,false],["40001",409,false],["23505",409,false],["network",503,true]])("maps %s without leaking provider text", async (code,status,uncertain) => {
    mocks.rpc.mockResolvedValue({ error: { code, message: "private answer" } })
    const result = await handleFormIntake(request(deletion))
    expect(result.status).toBe(status)
    expect(await result.json()).toMatchObject({ uncertain })
  })
  it("returns terminal deletion instead of a successful or retryable public submission", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: version }).mockResolvedValueOnce({ error: { code: "P0002" } })
    const result = await handleFormIntake(request(command))
    expect(result.status).toBe(410)
    expect(await result.json()).toEqual({ error: "This submission was deleted. It cannot be submitted again.", uncertain: false })
  })
})

describe("unpublished form collaboration HTTP boundary", () => {
  const target = { organizationId: id(1), formId: id(20) }
  it.each([
    [{ action: "form_source_entry", ...target }, { formId: id(20), title: "Draft", canManageInvitations: true }],
    [{ action: "form_source_directory", ...target, after: id(21) }, { forms: [{ formId: id(22), title: "Permitted draft" }], next: null }],
    [{ action: "read_form_source", ...target }, { formId: id(20), revision: "a".repeat(64), title: "Draft", description: "", definition: version.definition }],
  ])("dispatches an exact canonical target with verified actor and private response", async (command, value) => {
    mocks.rpc.mockResolvedValue({ data: value })
    const result = await handleFormIntake(request(command))
    expect(result.status).toBe(200); expect(await result.json()).toEqual({ value })
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("organization_form_source_command", { p_actor_id: id(1), p_command: command })
    expect(result.headers.get("cache-control")).toContain("no-store")
  })
  it.each([
    { action: "read_form_source", ...target, versionId: id(80) },
    { action: "read_form_source", organizationId: id(1) },
    { action: "form_source_directory", ...target, actorId: id(2) },
    { action: "viewer_offer", ...target, versionId: id(80) },
    { action: "accept_viewer", organizationId: id(1), invitationId: id(700) },
  ])("rejects ambiguous, incomplete and forged addresses before RPC", async command => {
    expect((await handleFormIntake(request(command))).status).toBe(400)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it("requires a session for draft discovery and invitation acceptance", async () => {
    mocks.auth.mockResolvedValue({ data: { user: null }, error: null })
    expect((await handleFormIntake(request({ action: "form_source_directory", ...target }))).status).toBe(401)
    expect((await handleFormIntake(request({ action: "accept_viewer", ...target, invitationId: id(700) }))).status).toBe(401)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it("keeps the exact draft save payload and treats an invalid reply as uncertain", async () => {
    const save = { action: "save_form_source", ...target, operationId: id(701), expectedRevision: "a".repeat(64), content: { title: "Draft", description: "", definition: version.definition } }
    mocks.rpc.mockResolvedValue({ data: { formId: id(20), operationId: id(701), revision: "invalid" } })
    const result = await handleFormIntake(request(save))
    expect(result.status).toBe(503); expect(await result.json()).toMatchObject({ uncertain: true })
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("organization_form_source_command", { p_actor_id: id(1), p_command: save })
  })
  it("accepts only a strictly addressed invitation receipt", async () => {
    const command = { action: "accept_viewer", ...target, invitationId: id(700) }
    const value = { ...target, invitationId: id(700), accepted: true }
    mocks.rpc.mockResolvedValue({ data: value })
    expect(await (await handleFormIntake(request(command))).json()).toEqual({ value })
    mocks.rpc.mockResolvedValue({ data: { ...value, versionId: id(80) } })
    const result = await handleFormIntake(request(command))
    expect(result.status).toBe(503); expect(await result.json()).toMatchObject({ uncertain: true })
  })
})
