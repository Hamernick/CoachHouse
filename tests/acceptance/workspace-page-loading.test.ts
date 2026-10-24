import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  after: vi.fn<(callback: () => void | Promise<void>) => void>(),
  context: vi.fn(),
  state: vi.fn(),
  content: vi.fn(),
  track: vi.fn(),
}))

vi.mock("next/server", () => ({ after: mocks.after }))
vi.mock("@/lib/auth/request-context", () => ({
  resolveOptionalAuthenticatedAppContext: mocks.context,
}))
vi.mock("@/components/app-shell/dashboard-layout-state", () => ({
  resolveDashboardLayoutState: mocks.state,
}))
vi.mock("@/lib/user-journey", () => ({
  trackUserJourneyMilestone: mocks.track,
}))
vi.mock(
  "@/app/(dashboard)/my-organization/_lib/my-organization-page-content",
  () => ({
    default: mocks.content,
  })
)

import WorkspacePage from "@/app/(dashboard)/workspace/page"

const state = {
  userPresent: true,
  isAdmin: false,
  currentPlanTier: "organization",
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.context.mockResolvedValue({
    user: { id: "viewer" },
    activeOrg: { orgId: "org" },
  })
  mocks.state.mockResolvedValue(state)
  mocks.content.mockResolvedValue("workspace")
  mocks.track.mockResolvedValue({ ok: true })
})

describe("workspace request loading", () => {
  it("starts workspace content while dashboard state is still pending", async () => {
    let release = () => {}
    const pending = new Promise<void>((resolve) => {
      release = resolve
    })
    mocks.state.mockImplementationOnce(async () => {
      await pending
      return state
    })

    const response = WorkspacePage({})
    expect(mocks.content).toHaveBeenCalledOnce()
    expect(mocks.after).not.toHaveBeenCalled()
    release()
    await expect(response).resolves.toBe("workspace")
  })

  it("returns content before analytics and captures the authenticated organization", async () => {
    await expect(WorkspacePage({})).resolves.toBe("workspace")
    expect(mocks.track).not.toHaveBeenCalled()
    expect(mocks.after).toHaveBeenCalledOnce()
    mocks.context.mockRejectedValueOnce(
      new Error("request no longer available")
    )

    for (const [callback] of mocks.after.mock.calls) await callback()
    expect(mocks.context).toHaveBeenCalledOnce()
    expect(mocks.track).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "viewer",
        orgId: "org",
        eventName: "workspace_viewed",
        checkpoint: "workspace_first_viewed",
        planTier: "organization",
      })
    )
  })

  it("preserves content redirects and does not record a successful view", async () => {
    const redirect = new Error("NEXT_REDIRECT")
    mocks.content.mockRejectedValueOnce(redirect)
    await expect(WorkspacePage({})).rejects.toBe(redirect)
    expect(mocks.after).not.toHaveBeenCalled()
  })

  it("does not track admins", async () => {
    mocks.state.mockResolvedValueOnce({ ...state, isAdmin: true })
    await WorkspacePage({})
    expect(mocks.after).not.toHaveBeenCalled()
  })

  it("does not track an unauthenticated request", async () => {
    mocks.context.mockResolvedValueOnce(null)
    await WorkspacePage({})
    expect(mocks.after).not.toHaveBeenCalled()
  })
})
