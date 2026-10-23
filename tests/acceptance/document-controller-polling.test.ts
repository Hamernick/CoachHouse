import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Editor } from "@tiptap/core"
import type { DocumentSyncResult, DocumentTransport } from "@/features/organization-document-collaboration/types"

// Execute the controller's real callbacks/effects with persistent hook slots.
// Editor rendering is irrelevant to these transport and lifecycle regressions.
const hooks = vi.hoisted(() => ({ cursor: 0, slots: [] as unknown[], effects: [] as Array<() => void>, cleanups: new Map<number, () => void>() }))
vi.mock("react", () => {
  const memo = <T,>(value: T, deps: unknown[]) => {
    const index = hooks.cursor++
    const previous = hooks.slots[index] as { value: T; deps: unknown[] } | undefined
    const changed = !previous || deps.some((dep, i) => !Object.is(dep, previous.deps[i]))
    if (changed) hooks.slots[index] = { value, deps }
    return { index, changed, value: changed ? value : previous!.value }
  }
  return {
    useRef: <T,>(initial: T) => { const index = hooks.cursor++; return hooks.slots[index] ??= { current: initial } },
    useState: <T,>(initial: T | (() => T)) => {
      const index = hooks.cursor++
      if (!(index in hooks.slots)) hooks.slots[index] = typeof initial === "function" ? (initial as () => T)() : initial
      return [hooks.slots[index], (next: T | ((value: T) => T)) => {
        hooks.slots[index] = typeof next === "function" ? (next as (value: T) => T)(hooks.slots[index] as T) : next
      }]
    },
    useCallback: <T,>(callback: T, deps: unknown[]) => memo(callback, deps).value,
    useEffect: (effect: () => (() => void) | undefined, deps: unknown[]) => {
      const { index, changed } = memo(effect, deps)
      if (changed) hooks.effects.push(() => { hooks.cleanups.get(index)?.(); hooks.cleanups.delete(index); const stop = effect(); if (stop) hooks.cleanups.set(index, stop) })
    },
  }
})
const editorMocks = vi.hoisted(() => ({ pending: false }))
vi.mock("@tiptap/pm/collab", () => ({
  collab: vi.fn(), getVersion: () => 0,
  sendableSteps: () => editorMocks.pending ? { steps: [] } : null,
  receiveTransaction: vi.fn(),
}))
vi.mock("@/features/organization-document-collaboration/lib/cursors", () => ({ documentCursorsPlugin: vi.fn(), documentCursorsKey: "cursors" }))
vi.mock("@/features/organization-document-collaboration/server/actions", () => ({ loadOrganizationDocumentVersions: vi.fn() }))
import { useOrganizationDocumentCollaborationController } from "@/features/organization-document-collaboration/hooks/use-organization-document-collaboration-controller"

let page: EventTarget & { visibilityState: string }
const scope = { organizationId: "org", sectionId: "origin" }
const loaded = (canEdit = true, session = true) => ({
  userId: "user", capabilities: { canEdit }, participants: [],
  section: { content: "Saved", budgetRows: [], lastUpdated: "revision" },
  session: session ? { generation: "generation", version: 0, steps: [], document: { type: "doc" } } : null,
}) as unknown as DocumentSyncResult

async function setup(canEdit = true, session = true) {
  const sync = vi.fn<DocumentTransport["sync"]>().mockResolvedValue(loaded(canEdit, session))
  const presence = vi.fn<NonNullable<DocumentTransport["presence"]>>().mockResolvedValue({ participants: [] })
  const transport: DocumentTransport = { sync, presence, leave: vi.fn(async () => {}), versions: vi.fn(async () => ({ versions: [] })) }
  const TestController = () => {
    hooks.cursor = 0
    const controller = useOrganizationDocumentCollaborationController(scope, "user", transport)
    hooks.effects.splice(0).forEach(effect => effect())
    return controller
  }
  TestController(); await vi.advanceTimersByTimeAsync(0)
  let controller = TestController()
  const chain = { setContent: vi.fn().mockReturnThis(), setMeta: vi.fn().mockReturnThis(), run: vi.fn() }
  const editor = { isDestroyed: false, chain: () => chain, registerPlugin: vi.fn(),
    state: { doc: { descendants: vi.fn() }, selection: { anchor: 0, head: 0 }, tr: { setMeta: vi.fn() } },
    view: { dispatch: vi.fn() }, getHTML: () => "Local copy", on: vi.fn(), off: vi.fn(),
  } as unknown as Editor
  await controller.onReady(editor)
  controller = TestController(); await vi.advanceTimersByTimeAsync(0)
  return { controller, render: TestController, sync, presence }
}
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(0); vi.spyOn(Math, "random").mockReturnValue(0)
  hooks.cursor = 0; hooks.slots = []; hooks.effects = []; hooks.cleanups.clear(); editorMocks.pending = false
  page = Object.assign(new EventTarget(), { visibilityState: "visible" })
  vi.stubGlobal("document", page)
  vi.stubGlobal("window", Object.assign(new EventTarget(), { localStorage: { length: 0, setItem: vi.fn(), removeItem: vi.fn() } }))
})
afterEach(() => {
  hooks.cleanups.forEach(stop => stop()); hooks.cleanups.clear()
  vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks()
})

describe("document controller polling regressions", () => {
  it.each([false, true])("uses one retry deadline across pending saves and focus (transport throws=%s)", async throws => {
    const { controller, sync } = await setup()
    editorMocks.pending = true; controller.dirty.current = true
    const attempts: number[] = []
    sync.mockImplementation(async () => {
      attempts.push(Date.now())
      if (throws) throw new Error("Offline")
      return { error: "Offline", code: "unavailable" }
    })
    // Wake the existing idle timer into the pending-document cadence.
    window.dispatchEvent(new Event("online")); await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(5000)
    expect(await controller.sync()).toBeUndefined() // Cooldown is a skip, not a failed request.
    page.dispatchEvent(new Event("visibilitychange"))
    await vi.advanceTimersByTimeAsync(85_000)
    expect(attempts).toEqual([0, 10_000, 30_000, 60_000, 90_000])
    expect(controller.dirty.current).toBe(true)
    sync.mockResolvedValue(loaded())
    editorMocks.pending = false
    await controller.retry()
    expect(controller.dirty.current).toBe(false)
  })

  it.each([true, false])("keeps presence for an authorized viewer with session=%s", async session => {
    const { controller, presence, render } = await setup(false, session)
    expect(controller.accessDenied).toBe(true) // Editing remains disabled.
    expect(presence).toHaveBeenCalledOnce()
    expect(presence.mock.calls[0][0].selection).toBeNull() // Viewers do not advertise editing.
    const participant = { session_id: "peer", actor_id: "peer", display_name: "Peer", role: "member", mode: "viewing" as const, selection: null }
    presence.mockResolvedValue({ participants: [participant] })
    await vi.advanceTimersByTimeAsync(10_000)
    expect(presence).toHaveBeenCalledTimes(2)
    expect(render().participants).toEqual([participant])
    page.visibilityState = "hidden"; page.dispatchEvent(new Event("visibilitychange"))
    await vi.advanceTimersByTimeAsync(30_000)
    expect(presence).toHaveBeenCalledTimes(2)
  })

  it.each(["denied", "unauthenticated"] as const)("stops presence after actual %s access failure", async code => {
    const { controller, sync, presence, render } = await setup()
    sync.mockResolvedValue({ error: "Access unavailable", code })
    await controller.sync(); render()
    const count = presence.mock.calls.length
    await vi.advanceTimersByTimeAsync(60_000)
    expect(presence).toHaveBeenCalledTimes(count)
  })
})
