import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { GuestDraftController } from "@/features/fiscal-sponsorship/lib/guest-draft-controller"

const hooks = vi.hoisted(() => ({ cursor: 0, slots: [] as unknown[] }))
vi.mock("react", () => ({
  useRef: (current: unknown) => { const index = hooks.cursor++; return hooks.slots[index] ??= { current } },
  useState: (initial: unknown) => {
    const index = hooks.cursor++
    if (!(index in hooks.slots)) hooks.slots[index] = initial
    return [hooks.slots[index], (value: unknown) => { hooks.slots[index] = value }]
  },
}))
vi.mock("@/features/fiscal-sponsorship/lib/guest-submission-input", () => ({
  guestFieldName: (path: string[]) => path.at(-1),
  guestSubmissionInput: () => ({ success: true, data: { application: { projectName: "Preserved answers" } } }),
}))
import { usePublicFiscalSubmission } from "@/features/fiscal-sponsorship/components/use-public-fiscal-submission"

function setup() {
  const flush = vi.fn(async () => true)
  const acceptSubmission = vi.fn()
  const controller = { getSnapshot: () => ({ draft: {} }), flush, acceptSubmission, expireSession: vi.fn() } as unknown as GuestDraftController
  const TestSubmission = () => { hooks.cursor = 0; return usePublicFiscalSubmission(controller) }
  return { hook: TestSubmission(), render: TestSubmission, flush, acceptSubmission }
}

beforeEach(() => { hooks.cursor = 0; hooks.slots = []; vi.stubGlobal("fetch", vi.fn()) })
afterEach(() => { vi.unstubAllGlobals() })

describe("fiscal submission without CAPTCHA", () => {
  it("submits answers without a challenge or token", async () => {
    const test = setup()
    vi.mocked(fetch).mockResolvedValue(Response.json({ ok: true, reference: "20000000-0000-4000-8000-000000000001" }))
    await test.hook.submit()
    expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)).toEqual({ application: { projectName: "Preserved answers" } })
    expect(test.acceptSubmission).toHaveBeenCalledOnce()
    expect(test.render()).toMatchObject({ working: false, uncertain: false })
  })
  it("still requires the draft to be saved before submission", async () => {
    const test = setup()
    test.flush.mockResolvedValue(false)
    await test.hook.submit()
    expect(fetch).not.toHaveBeenCalled()
    expect(test.render()).toMatchObject({ working: false, uncertain: false, message: expect.stringContaining("draft needs attention") })
  })
  it("releases editing after a definite rejection and preserves answers on retry", async () => {
    const test = setup()
    vi.mocked(fetch).mockImplementation(async () => Response.json({ error: "Please wait before trying again." }, { status: 429 }))
    await test.hook.submit()
    expect(test.render()).toMatchObject({ working: false, uncertain: false, message: expect.stringContaining("answers are saved") })
    await test.render().submit()
    expect(vi.mocked(fetch).mock.calls[1][1]!.body).toBe(vi.mocked(fetch).mock.calls[0][1]!.body)
  })
  it("preserves the exact request for an uncertain write and accepts its receipt on retry", async () => {
    const test = setup()
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ error: "Unknown write result." }, { status: 503 }))
      .mockResolvedValueOnce(Response.json({ ok: true, reference: "20000000-0000-4000-8000-000000000001" }))
    await test.hook.submit()
    expect(test.render().uncertain).toBe(true)
    await test.render().submit()
    expect(vi.mocked(fetch).mock.calls[1][1]!.body).toBe(vi.mocked(fetch).mock.calls[0][1]!.body)
    expect(test.flush).toHaveBeenCalledOnce()
    expect(test.acceptSubmission).toHaveBeenCalledOnce()
    expect(test.render().uncertain).toBe(false)
  })
})
