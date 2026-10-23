import type { ReactElement } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const harness = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0, load: vi.fn(), mutate: vi.fn() }))
vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useState: (initial: unknown) => {
    const index = harness.cursor++
    if (!(index in harness.slots)) harness.slots[index] = initial
    return [harness.slots[index], (next: unknown) => { harness.slots[index] = typeof next === "function" ? next(harness.slots[index]) : next }]
  },
  useRef: (initial: unknown) => {
    const index = harness.cursor++
    if (!(index in harness.slots)) harness.slots[index] = { current: initial }
    return harness.slots[index]
  },
  useCallback: (callback: unknown) => callback,
  useEffect: () => {},
}))
vi.mock("@/features/member-workspace/project-workflow-actions", () => ({ loadProjectAssetFolders: harness.load, mutateProjectAssetFolder: harness.mutate }))
vi.mock("@/components/ui/button", () => ({ Button: "button" }))
vi.mock("@/components/ui/input", () => ({ Input: "input" }))
vi.mock("@/features/member-workspace/components/projects/project-folder-document-editor", () => ({ ProjectFolderDocumentEditor: () => null }))
vi.mock("@/features/member-workspace/components/projects/project-asset-folder-grid", () => ({ ProjectAssetFolderGrid: () => null }))
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
import { ProjectAssetFolders } from "@/features/member-workspace/components/projects/project-asset-folders"

const library = { state: { folders: [], placements: [] }, files: [], canEdit: false, canUpload: true, organizationDocuments: null, organizationId: "host" }
const fetchMock = vi.fn()
function render() {
  harness.cursor = 0
  return ProjectAssetFolders({ projectId: "guest-project", actionScope: "platform" })
}
function find(node: unknown, predicate: (element: ReactElement<Record<string, unknown>>) => boolean): ReactElement<Record<string, unknown>> | undefined {
  if (!node || typeof node !== "object") return undefined
  if (Array.isArray(node)) return node.map((child) => find(child, predicate)).find(Boolean)
  const element = node as ReactElement<Record<string, unknown>>
  if (predicate(element)) return element
  return find(element.props?.children, predicate)
}
const retryButton = (tree: unknown) => find(tree, (element) => element.type === "button" && element.props.children === "Retry upload")
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))
beforeEach(() => {
  vi.clearAllMocks()
  harness.slots = [library]
  harness.load.mockResolvedValue(library)
  vi.stubGlobal("fetch", fetchMock)
})

describe("Files tab upload recovery", () => {
  it("retries the retained batch after a lost response using the same upload ID and File objects", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Network response lost"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ assets: [{ id: "saved-file" }] }), { status: 200 }))
    const files = [new File(["first"], "first.pdf"), new File(["second"], "second.pdf")]
    const picker = find(render(), (element) => element.props?.["aria-label"] === "Upload files")!
    const onChange = picker.props.onChange as (event: unknown) => void
    const target = { files, value: "picked" }
    onChange({ target })
    expect(target.value).toBe("")
    await settle()
    const retry = retryButton(render())!
    expect(retry).toBeDefined()
    ;(retry.props.onClick as () => void)()
    await settle()
    const first = fetchMock.mock.calls[0][1].body as FormData
    const retried = fetchMock.mock.calls[1][1].body as FormData
    expect(retried.get("uploadId")).toBe(first.get("uploadId"))
    expect(retried.getAll("files")[0]).toBe(files[0])
    expect(retried.getAll("files")[1]).toBe(files[1])
    expect(retryButton(render())).toBeUndefined()
    expect(harness.load).toHaveBeenCalledTimes(2)
  })
  it("retains a partial batch for retry while refreshing the already saved files", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: "Second file failed. Earlier files are saved.", assets: [{ id: "first-saved" }] }), { status: 400 }))
    const picker = find(render(), (element) => element.props?.["aria-label"] === "Upload files")!
    ;(picker.props.onChange as (event: unknown) => void)({ target: { files: [new File(["a"], "a.pdf"), new File(["b"], "b.pdf")], value: "" } })
    await settle()
    expect(retryButton(render())).toBeDefined()
    expect(harness.load).toHaveBeenCalledWith("guest-project", "platform")
  })
})
