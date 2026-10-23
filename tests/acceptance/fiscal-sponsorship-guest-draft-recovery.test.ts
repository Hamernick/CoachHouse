import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { GuestDraftController } from "@/features/fiscal-sponsorship/lib/guest-draft-controller"
import { GUEST_DRAFT_RECOVERY_KEY, GuestDraftRecovery } from "@/features/fiscal-sponsorship/lib/guest-draft-recovery"

const expiry = "2026-10-22T00:00:00Z"
const reference = "20000000-0000-4000-8000-000000000001"
const draftResponse = (draft = {}, version = 0) => Response.json({ state: "draft", draft, version, expiresAt: expiry })
const clients: GuestDraftController[] = []
function storage() {
  const values = new Map<string, string>()
  return {
    values,
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { values.set(key, value) }),
    removeItem: vi.fn((key: string) => { values.delete(key) }),
  }
}
function setup(store = storage()) {
  const transport = vi.fn<typeof fetch>().mockImplementation(async (url, init) => {
    if (String(url).endsWith("session")) return Response.json({ ok: true })
    const body = JSON.parse(String(init?.body))
    return body.operation === "read" ? draftResponse() : draftResponse(body.draft, body.version + 1)
  })
  const client = new GuestDraftController(true, transport, new GuestDraftRecovery(() => store))
  clients.push(client)
  const saves = () => transport.mock.calls.map(([, init]) => JSON.parse(String(init?.body))).filter((body) => body.operation === "save")
  return { client, transport, store, saves }
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-15T00:00:00Z")) })
afterEach(() => { clients.splice(0).forEach((client) => client.stop()); vi.useRealTimers() })

describe("same-tab fiscal draft recovery", () => {
  it("stores each edit immediately, before the debounce or online acknowledgement", async () => {
    const { client, store, saves } = setup()
    await client.start()
    client.edit("projectName", "Still typing")
    expect(saves()).toHaveLength(0)
    expect(JSON.parse(store.values.get(GUEST_DRAFT_RECOVERY_KEY)!)).toMatchObject({ draft: { projectName: "Still typing" } })
    expect(client.getSnapshot()).toMatchObject({ localBackup: true, dirty: true, saved: false })
  })

  it("restores answers after reload while the database remains unavailable", async () => {
    const first = setup()
    await first.client.start()
    first.client.edit("projectName", "Keep this application")
    first.client.edit("primaryEmail", "unfinished@")
    first.transport.mockRejectedValueOnce(new Error("database unavailable"))
    await first.client.save()
    first.client.stop()
    const reloaded = setup(first.store)
    reloaded.transport.mockRejectedValueOnce(new Error("database still unavailable"))
    await reloaded.client.start()
    expect(reloaded.client.getSnapshot()).toMatchObject({
      phase: "error", draft: { projectName: "Keep this application", primaryEmail: "unfinished@" },
      dirty: true, saved: false, localBackup: true,
      error: "Your answers are backed up in this tab. Retry to save online.",
    })
    expect(reloaded.saves()).toHaveLength(0)
    expect(await reloaded.client.flush()).toBe(false)
  })

  it("retries the identical uncertain write after reload and reconciliation", async () => {
    const first = setup()
    await first.client.start()
    first.client.edit("projectName", "First")
    first.transport.mockRejectedValueOnce(new Error("lost acknowledgement"))
    await first.client.save()
    first.client.edit("projectName", "Latest")
    first.client.stop()
    const reloaded = setup(first.store)
    await reloaded.client.start()
    await vi.advanceTimersByTimeAsync(1000)
    expect(reloaded.saves()[0]).toEqual(first.saves()[0])
    await vi.advanceTimersByTimeAsync(1000)
    expect(reloaded.saves()[1]).toMatchObject({ version: 1, draft: { projectName: "Latest" } })
    expect(reloaded.client.getSnapshot()).toMatchObject({ phase: "ready", dirty: false, saved: true })
  })

  it("recognizes a committed write without overwriting newer recovered edits", async () => {
    const first = setup()
    await first.client.start()
    first.client.edit("projectName", "Committed")
    first.transport.mockRejectedValueOnce(new Error("lost acknowledgement"))
    await first.client.save()
    first.client.edit("projectName", "Newer edit")
    first.client.stop()
    const reloaded = setup(first.store)
    reloaded.transport.mockResolvedValueOnce(Response.json({ ok: true }))
      .mockResolvedValueOnce(draftResponse(first.saves()[0].draft, 1))
    await reloaded.client.start()
    await vi.advanceTimersByTimeAsync(1000)
    expect(reloaded.saves()).toHaveLength(1)
    expect(reloaded.saves()[0]).toMatchObject({ version: 1, draft: { projectName: "Newer edit" } })
    expect(reloaded.saves()[0].requestId).not.toBe(first.saves()[0].requestId)
  })

  it("rebases unsaved edits only when the confirmed server baseline still matches", async () => {
    const first = setup()
    await first.client.start()
    first.client.edit("projectName", "Saved")
    await first.client.save()
    const confirmed = first.saves()[0].draft
    first.client.edit("projectName", "Unsaved")
    first.client.stop()
    const reloaded = setup(first.store)
    reloaded.transport.mockResolvedValueOnce(Response.json({ ok: true })).mockResolvedValueOnce(draftResponse(confirmed, 1))
    await reloaded.client.start()
    expect(reloaded.client.getSnapshot()).toMatchObject({ phase: "ready", draft: { projectName: "Unsaved" }, dirty: true })
    await vi.advanceTimersByTimeAsync(1000)
    expect(reloaded.saves()[0]).toMatchObject({ version: 1, draft: { projectName: "Unsaved" } })
  })

  it("keeps recovered answers and blocks automatic writes if another tab changed the server draft", async () => {
    const first = setup()
    await first.client.start()
    first.client.edit("projectName", "Saved")
    await first.client.save()
    first.client.edit("projectName", "Recovered")
    first.client.stop()
    const reloaded = setup(first.store)
    reloaded.transport.mockResolvedValueOnce(Response.json({ ok: true })).mockResolvedValueOnce(draftResponse({ projectName: "Other tab" }, 2))
    await reloaded.client.start()
    expect(reloaded.client.getSnapshot()).toMatchObject({ phase: "conflict", draft: { projectName: "Recovered" }, dirty: true, localBackup: true })
    await vi.advanceTimersByTimeAsync(2000)
    expect(reloaded.saves()).toHaveLength(0)
    expect(await reloaded.client.flush()).toBe(false)
  })

  it("recovers edits made before the first online draft read ever succeeded", async () => {
    const first = setup()
    first.transport.mockRejectedValueOnce(new Error("initial session unavailable"))
    await first.client.start()
    first.client.edit("projectName", "Never saved online")
    first.client.stop()
    const reloaded = setup(first.store)
    await reloaded.client.start()
    await vi.advanceTimersByTimeAsync(1000)
    expect(reloaded.saves()[0]).toMatchObject({ version: 0, draft: { projectName: "Never saved online" } })
    expect(reloaded.client.getSnapshot()).toMatchObject({ phase: "ready", saved: true, dirty: false })
  })

  it("replaces recovered answers only through the explicit saved-draft action", async () => {
    const first = setup()
    await first.client.start()
    first.client.edit("projectName", "Recovered")
    first.client.stop()
    const reloaded = setup(first.store)
    reloaded.transport.mockResolvedValueOnce(Response.json({ ok: true })).mockResolvedValueOnce(draftResponse({ projectName: "Other tab" }, 2))
    await reloaded.client.start()
    expect(reloaded.client.getSnapshot().draft.projectName).toBe("Recovered")
    reloaded.transport.mockResolvedValueOnce(Response.json({ ok: true })).mockResolvedValueOnce(draftResponse({ projectName: "Other tab" }, 2))
    await reloaded.client.reloadSaved()
    expect(reloaded.client.getSnapshot()).toMatchObject({ draft: { projectName: "Other tab" }, dirty: false })
    expect(JSON.parse(first.store.values.get(GUEST_DRAFT_RECOVERY_KEY)!).draft.projectName).toBe("Other tab")
  })

  it("can display the last confirmed answers during a database outage after reload", async () => {
    const first = setup()
    await first.client.start()
    first.client.edit("projectName", "Confirmed")
    await first.client.save()
    first.client.stop()
    const reloaded = setup(first.store)
    reloaded.transport.mockRejectedValueOnce(new Error("unavailable"))
    await reloaded.client.start()
    expect(reloaded.client.getSnapshot()).toMatchObject({ draft: { projectName: "Confirmed" }, phase: "error", saved: false, localBackup: true })
  })

  it("preserves overlong text through reload until the applicant shortens it", async () => {
    const first = setup()
    await first.client.start()
    first.client.edit("projectName", "x".repeat(201))
    first.client.stop()
    const reloaded = setup(first.store)
    await reloaded.client.start()
    expect(reloaded.client.getSnapshot()).toMatchObject({ phase: "invalid", dirty: true, localBackup: true })
    expect(reloaded.client.getSnapshot().draft.projectName).toHaveLength(201)
    reloaded.client.edit("projectName", "Short enough")
    await vi.advanceTimersByTimeAsync(1000)
    expect(reloaded.client.getSnapshot()).toMatchObject({ phase: "ready", dirty: false, saved: true })
  })

  it("clears recovery on submission and does not resurrect it on reload", async () => {
    const first = setup()
    await first.client.start()
    first.client.edit("projectName", "Submitted")
    first.client.acceptSubmission(reference)
    expect(first.store.values.has(GUEST_DRAFT_RECOVERY_KEY)).toBe(false)
    expect(first.client.getSnapshot().localBackup).toBe(false)
    first.client.stop()
    const reloaded = setup(first.store)
    await reloaded.client.start()
    expect(reloaded.client.getSnapshot().draft.projectName).toBe("")
  })

  it("clears recovery when the server confirms an earlier submission", async () => {
    const first = setup()
    await first.client.start()
    first.client.edit("projectName", "Already submitted")
    first.client.stop()
    const reloaded = setup(first.store)
    reloaded.transport.mockResolvedValueOnce(Response.json({ ok: true })).mockResolvedValueOnce(Response.json({ state: "submitted", reference }))
    await reloaded.client.start()
    expect(reloaded.client.getSnapshot().phase).toBe("submitted")
    expect(first.store.values.has(GUEST_DRAFT_RECOVERY_KEY)).toBe(false)
  })

  it("does not resurrect an edit reverted before its first server save", async () => {
    const first = setup()
    await first.client.start()
    first.client.edit("projectName", "Temporary")
    first.client.edit("projectName", "")
    expect(first.store.values.has(GUEST_DRAFT_RECOVERY_KEY)).toBe(false)
  })

  it("never caches protected internal fields or authentication capabilities", async () => {
    const { client, store } = setup()
    await client.start()
    client.edit("projectName", "Public form answers")
    const cached = JSON.parse(store.values.get(GUEST_DRAFT_RECOVERY_KEY)!)
    expect(Object.keys(cached)).toEqual(expect.arrayContaining(["draft", "version", "baseline", "pending", "expiresAt", "format", "recoveryExpiresAt"]))
    for (const field of ["projectId", "sourceSnapshot", "budgetRows", "status", "accountId", "cookie", "token"]) {
      expect(cached.draft).not.toHaveProperty(field)
      expect(cached).not.toHaveProperty(field)
    }
  })

  it("leaves preview mode memory-only", async () => {
    const store = storage()
    const transport = vi.fn<typeof fetch>()
    const client = new GuestDraftController(false, transport, new GuestDraftRecovery(() => store))
    clients.push(client)
    await client.start()
    client.edit("projectName", "Preview")
    expect(store.getItem).not.toHaveBeenCalled()
    expect(store.setItem).not.toHaveBeenCalled()
    expect(transport).not.toHaveBeenCalled()
  })

  it("keeps answers in memory and never claims a backup when storage is blocked", async () => {
    const store = storage()
    store.setItem.mockImplementation(() => { throw new Error("quota exceeded") })
    const { client, transport } = setup(store)
    await client.start()
    client.edit("projectName", "Keep open")
    transport.mockRejectedValueOnce(new Error("offline"))
    await client.save()
    expect(client.getSnapshot()).toMatchObject({ localBackup: false, draft: { projectName: "Keep open" }, dirty: true })
    expect(client.getSnapshot().error).toContain("Keep this page open")
  })

  it.each(["quota", "oversize", "validation"])("removes stale recovery after a later %s failure", async (failure) => {
    const first = setup()
    await first.client.start()
    first.client.edit("projectName", "Earlier answer")
    expect(first.store.values.has(GUEST_DRAFT_RECOVERY_KEY)).toBe(true)
    if (failure === "quota") {
      first.store.setItem.mockImplementation(() => { throw new Error("quota exceeded") })
      first.client.edit("projectName", "Latest answer")
    } else if (failure === "oversize") {
      for (const field of ["projectDescription", "expenseSummary", "prospectiveFundingSources", "publicBenefit", "leadershipBackground"] as const) {
        first.client.edit(field, "x".repeat(60000))
      }
    } else {
      first.client.edit("projectName", "x".repeat(65537))
    }
    expect(first.client.getSnapshot()).toMatchObject({ localBackup: false, dirty: true })
    expect(first.store.values.has(GUEST_DRAFT_RECOVERY_KEY)).toBe(false)
    first.client.stop()
    const reloaded = setup(first.store)
    await reloaded.client.start()
    await vi.advanceTimersByTimeAsync(1000)
    expect(reloaded.client.getSnapshot().draft.projectName).toBe("")
    expect(reloaded.saves()).toHaveLength(0)
  })

  it("still works online when reading browser storage throws", async () => {
    const store = storage()
    store.getItem.mockImplementation(() => { throw new Error("access denied") })
    const { client } = setup(store)
    await client.start()
    client.edit("projectName", "Online still works")
    await client.save()
    expect(client.getSnapshot()).toMatchObject({ phase: "ready", saved: true, dirty: false })
  })

  it.each(["corrupt", "expired", "protected", "oversized"])("ignores %s recovery records", async (kind) => {
    const first = setup()
    await first.client.start()
    first.client.edit("projectName", "Must not restore")
    first.client.stop()
    const cached = JSON.parse(first.store.values.get(GUEST_DRAFT_RECOVERY_KEY)!)
    if (kind === "expired") cached.recoveryExpiresAt = Date.now() - 1
    if (kind === "protected") cached.draft.projectId = "forged-internal-id"
    first.store.values.set(GUEST_DRAFT_RECOVERY_KEY, kind === "corrupt" ? "bad json" : kind === "oversized" ? "x".repeat(300000) : JSON.stringify(cached))
    const reloaded = setup(first.store)
    await reloaded.client.start()
    expect(reloaded.client.getSnapshot()).toMatchObject({ phase: "ready", draft: { projectName: "" }, dirty: false })
    expect(first.store.values.has(GUEST_DRAFT_RECOVERY_KEY)).toBe(false)
  })

  it("does not extend retention on every keystroke", async () => {
    const { client, store } = setup()
    await client.start()
    client.edit("projectName", "First")
    const deadline = JSON.parse(store.values.get(GUEST_DRAFT_RECOVERY_KEY)!).recoveryExpiresAt
    vi.setSystemTime(Date.now() + 86400000)
    client.edit("projectName", "Later")
    expect(JSON.parse(store.values.get(GUEST_DRAFT_RECOVERY_KEY)!).recoveryExpiresAt).toBe(deadline)
  })
})
