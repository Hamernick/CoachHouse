import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactElement, ReactNode } from "react"
import { OrganizationAccessRequestsPanel } from "@/features/organization-access/components/organization-access-requests-panel"
import type { OrganizationAccessRequest } from "@/features/organization-access/types"

const mocks = vi.hoisted(() => ({ assign: vi.fn(), push: vi.fn(), error: vi.fn(), transition: Promise.resolve() }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }))
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: mocks.error } }))
vi.mock("react", async () => ({
  ...await vi.importActual("react"),
  useMemo: (factory: () => unknown) => factory(),
  useState: (value: unknown) => [value, vi.fn()],
  useTransition: () => [false, (run: () => Promise<void>) => { mocks.transition = run() }],
}))

function buttons(node: ReactNode): Array<ReactElement<{ children?: ReactNode; onClick?: () => void }>> {
  if (Array.isArray(node)) return node.flatMap(buttons)
  if (!node || typeof node !== "object" || !("props" in node)) return []
  const element = node as ReactElement<{ children?: ReactNode; onClick?: () => void }>
  return [...(element.props.onClick ? [element] : []), ...buttons(element.props.children)]
}
const request = {
  id: "request", orgId: "invited-org", organizationName: "Invited organization",
  inviteeUserId: "member", inviteeEmail: "member@example.test", role: "staff", status: "pending",
  createdAt: "2026-11-20T00:00:00Z", expiresAt: "2099-01-01T00:00:00Z",
} as OrganizationAccessRequest

async function respond(result: { ok: true; orgId: string; status: "accepted" | "declined" } | { error: string }, decline = false) {
  const action = vi.fn().mockResolvedValue(result)
  const tree = OrganizationAccessRequestsPanel({ initialRequests: [request], acceptRequestAction: action, declineRequestAction: action })
  const onClick = buttons(tree)[decline ? 1 : 0].props.onClick
  if (!onClick) throw new Error("Missing request response button")
  onClick()
  await mocks.transition
  expect(action).toHaveBeenCalledWith("request")
}

describe("access request workspace entry", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("window", { location: { assign: mocks.assign } })
  })
  afterEach(() => vi.unstubAllGlobals())

  it("enters the accepted workspace with a fresh document, clearing the old tab fetch scope", async () => {
    await respond({ ok: true, orgId: "invited-org", status: "accepted" })
    expect(mocks.assign).toHaveBeenCalledWith("/workspace?joined=1")
    expect(mocks.push).not.toHaveBeenCalled()
  })
  it("does not navigate after a declined request", async () => {
    await respond({ ok: true, orgId: "invited-org", status: "declined" }, true)
    expect(mocks.assign).not.toHaveBeenCalled()
    expect(mocks.push).not.toHaveBeenCalled()
  })
  it("keeps a rejected request recoverable without navigating", async () => {
    await respond({ error: "This request has expired." })
    expect(mocks.error).toHaveBeenCalledWith("This request has expired.")
    expect(mocks.assign).not.toHaveBeenCalled()
    expect(mocks.push).not.toHaveBeenCalled()
  })
})
