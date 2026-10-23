import type { ReactElement } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ upload: vi.fn(), validate: vi.fn(), discover: vi.fn(), register: vi.fn() }))
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), useRef: (current: unknown) => ({ current }), useState: (value: unknown) => [value, vi.fn()] }))
vi.mock("@/features/workspace-particles/client", () => ({ useParticleLibraryDropTarget: mocks.register, uploadParticleFile: mocks.upload, particleFileError: mocks.validate, PARTICLE_FILE_ACCEPT: ".txt,.pdf" }))
vi.mock("@/actions/workspace-opportunity-sources", () => ({ getWorkspaceOpportunitySources: mocks.discover }))
import { OpportunitySourceDropZone } from "@/features/workspace-finance/components/opportunity-source-drop-zone"
import { ID, WORKSPACE } from "./fixtures/particle-fixtures"
import type { OpportunitySource } from "@/features/workspace-finance/lib/opportunity-sources"
const tick = async () => { for (let i = 0; i < 20; i++) await Promise.resolve() }
function harness(value: OpportunitySource[] = []) {
  const change = vi.fn(), options = vi.fn(), busy = vi.fn()
  const root = OpportunitySourceDropZone({ organizationId: WORKSPACE, children: () => null, value, onChange: change, onOptionsAdded: options, disabled: false, onBusyChange: busy }) as ReactElement<{ onDrop: (event: unknown) => void }>
  return { change, options, busy, drop: (files: File[]) => {
    const event = { preventDefault: vi.fn(), stopPropagation: vi.fn(), dataTransfer: { types: ["Files"], files } }
    root.props.onDrop(event)
    expect(event.preventDefault).toHaveBeenCalled()
    expect(event.stopPropagation).toHaveBeenCalled()
  } }
}
beforeEach(() => { vi.clearAllMocks(); mocks.validate.mockReturnValue(null); mocks.upload.mockResolvedValue({ fileId: ID(1) }) })
describe("opportunity file drop", () => {
  it("uploads and attaches a canonical reference while preventing canvas/browser drop handling", async () => {
    const h = harness(), file = new File(["brief"], "brief.txt", { type: "text/plain" })
    h.drop([file]); await tick()
    expect(mocks.upload).toHaveBeenCalledWith(WORKSPACE, file)
    expect(h.change).toHaveBeenLastCalledWith([{ kind: "file", id: ID(1) }])
    expect(h.options).toHaveBeenCalledWith([expect.objectContaining({ title: "brief.txt" })])
    expect(h.busy.mock.calls).toEqual([[true], [false]])
    h.drop([file]); await tick()
    expect(mocks.upload).toHaveBeenCalledTimes(1)
  })
  it("preserves successful attachments when another file fails and clears busy state", async () => {
    const h = harness()
    mocks.upload.mockRejectedValueOnce(new Error("Storage unavailable"))
    h.drop([new File(["a"], "bad.txt"), new File(["b"], "good.txt")]); await tick()
    expect(mocks.upload).toHaveBeenCalledTimes(2)
    expect(h.change).toHaveBeenLastCalledWith([{ kind: "file", id: ID(1) }])
    expect(h.busy).toHaveBeenLastCalledWith(false)
  })
  it("rejects unsupported files and source overflow before uploading", async () => {
    mocks.validate.mockReturnValue("Unsupported file")
    harness().drop([new File(["x"], "program.exe")]); await tick()
    harness(Array.from({ length: 20 }, (_, n) => ({ kind: "file", id: ID(n + 2) }))).drop([new File(["x"], "brief.txt")]); await tick()
    expect(mocks.upload).not.toHaveBeenCalled()
  })
  it("does not attach a removed or unauthorized document", async () => {
    const h = harness()
    mocks.discover.mockResolvedValue({ options: [] })
    const handler = mocks.register.mock.calls[0][1]
    expect(await handler({ request: { kind: "existing", drag: { kind: "particle", workspaceId: WORKSPACE, id: ID(1) } } })).toBe(false)
    expect(h.change).not.toHaveBeenCalled()
    expect(h.busy).toHaveBeenLastCalledWith(false)
  })
})
