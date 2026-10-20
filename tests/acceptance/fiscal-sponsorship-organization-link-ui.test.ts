import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactElement, ReactNode } from "react"
const mocks = vi.hoisted(() => ({
  values: [] as unknown[], cursor: 0, effects: [] as Array<() => unknown>, request: { current: null as unknown },
  link: vi.fn(), search: vi.fn(), refresh: vi.fn(),
}))
vi.mock("react", async (importOriginal) => ({
  ...await importOriginal<typeof import("react")>(),
  useState: (initial: unknown) => {
    const index = mocks.cursor++
    if (!(index in mocks.values)) mocks.values[index] = initial
    return [mocks.values[index], (value: unknown) => { mocks.values[index] = typeof value === "function" ? value(mocks.values[index]) : value }]
  },
  useRef: () => mocks.request,
  useEffect: (effect: () => unknown) => { mocks.effects.push(effect) },
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }))
vi.mock("@/features/fiscal-sponsorship/actions", () => ({ linkFiscalOrganization: mocks.link, searchFiscalOrganizationLink: mocks.search }))
import { FiscalGuestOrganizationLink } from "@/features/fiscal-sponsorship/components/fiscal-guest-organization-link"
const projectId = "20000000-0000-4000-8000-000000000001"
const selected = { organizationId: "30000000-0000-4000-8000-000000000001", name: "Applicant organization", ownerEmail: "owner@example.test", version: "a".repeat(32) }
function find(node: ReactNode, label: string): ReactElement<{ onClick: () => void }> | null {
  if (!node || typeof node !== "object") return null
  if (Array.isArray(node)) return node.map((child) => find(child, label)).find(Boolean) ?? null
  const element = node as ReactElement<{ children?: ReactNode; onClick: () => void }>
  if (element.props?.children === label) return element
  return find(element.props?.children, label)
}
const render = () => { mocks.cursor = 0; return FiscalGuestOrganizationLink({ projectId, applicantEmail: selected.ownerEmail }) }
const settle = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve() }
beforeEach(() => {
  vi.resetAllMocks(); mocks.values = [true, "", null, selected, false, "", false]; mocks.cursor = 0; mocks.effects = []; mocks.request.current = null
})
describe("fiscal organization link transport recovery", () => {
  it("releases busy and retries the exact request after a lost server-action response", async () => {
    mocks.link.mockRejectedValueOnce(new Error("Network lost")).mockResolvedValueOnce({ linked: { organizationId: selected.organizationId, name: selected.name } })
    find(render(), "Confirm organization link")!.props.onClick()
    await settle()
    const originalRequest = mocks.request.current
    expect(originalRequest).toMatchObject({ projectId, organizationId: selected.organizationId })
    expect(mocks.values[4]).toBe(false)
    expect(mocks.values[6]).toBe(true)
    expect(mocks.values[3]).toEqual(selected)
    find(render(), "Retry link")!.props.onClick()
    await settle()
    expect(mocks.link).toHaveBeenNthCalledWith(2, originalRequest)
    expect(mocks.request.current).toBeNull()
    expect(mocks.refresh).toHaveBeenCalledOnce()
  })
  it("settles a rejected search and reports a recoverable error", async () => {
    vi.useFakeTimers()
    try {
      mocks.values[3] = null
      mocks.search.mockRejectedValue(new Error("Network lost"))
      render(); mocks.effects[0]()
      await vi.advanceTimersByTimeAsync(250)
      expect(mocks.values[4]).toBe(false)
      expect(mocks.values[5]).toBe("Unable to search organizations. Try again.")
    } finally { vi.useRealTimers() }
  })
})
