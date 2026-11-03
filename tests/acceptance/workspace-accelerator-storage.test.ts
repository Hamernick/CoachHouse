import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Run the actual controller effects/callbacks with persistent hook slots.
const hooks = vi.hoisted(() => ({ cursor: 0, slots: [] as unknown[], effects: [] as Array<() => void>, cleanups: new Map<number, () => void>() }))
vi.mock("react", () => {
  const memo = <T,>(value: T, deps: unknown[]) => {
    const index = hooks.cursor++
    const previous = hooks.slots[index] as { value: T; deps: unknown[] } | undefined
    const changed = !previous || deps.length !== previous.deps.length || deps.some((dep, i) => !Object.is(dep, previous.deps[i]))
    if (changed) hooks.slots[index] = { value, deps }
    return { index, changed, value: changed ? value : previous!.value }
  }
  return {
    useRef: <T,>(initial: T) => { const index = hooks.cursor++; return hooks.slots[index] ??= { current: initial } },
    useState: <T,>(initial: T) => {
      const index = hooks.cursor++
      if (!(index in hooks.slots)) hooks.slots[index] = initial
      return [hooks.slots[index], (next: T | ((value: T) => T)) => {
        hooks.slots[index] = typeof next === "function" ? (next as (value: T) => T)(hooks.slots[index] as T) : next
      }]
    },
    useCallback: <T,>(callback: T, deps: unknown[]) => memo(callback, deps).value,
    useMemo: <T,>(factory: () => T, deps: unknown[]) => memo(factory(), deps).value,
    useEffect: (effect: () => (() => void) | undefined, deps: unknown[]) => {
      const { index, changed } = memo(effect, deps)
      if (changed) hooks.effects.push(() => { hooks.cleanups.get(index)?.(); hooks.cleanups.delete(index); const stop = effect(); if (stop) hooks.cleanups.set(index, stop) })
    },
    startTransition: (callback: () => void) => callback(),
  }
})
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }))

import { useWorkspaceAcceleratorCardController } from "@/features/workspace-accelerator-card/hooks/use-workspace-accelerator-card-controller"
import type { WorkspaceAcceleratorCardInput } from "@/features/workspace-accelerator-card/types"

const positionKey = "workspace-accelerator-card:org:actor"
const completedKey = "workspace-accelerator-card-complete:org:actor"
let values: Map<string, string>
let storage: Storage

function setup(overrides: Partial<WorkspaceAcceleratorCardInput> = {}) {
  const save = vi.fn().mockResolvedValue({ ok: true })
  const input = {
    size: "sm", storageKey: "org:actor", onStepComplete: save,
    steps: ["video", "resources"].map(kind => ({
      id: `lesson:${kind}`, moduleId: "lesson", moduleTitle: "Vision", stepTitle: kind,
      stepKind: kind, href: "/lesson", status: "not_started", resources: [],
    })), ...overrides,
  } as WorkspaceAcceleratorCardInput
  const TestController = () => {
    hooks.cursor = 0
    const controller = useWorkspaceAcceleratorCardController(input)
    hooks.effects.splice(0).forEach(effect => effect())
    return controller
  }
  TestController()
  return { render: TestController, input, save, controller: TestController() }
}

beforeEach(() => {
  hooks.cursor = 0; hooks.slots = []; hooks.effects = []; hooks.cleanups.clear()
  values = new Map()
  storage = {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { values.set(key, value) }),
    removeItem: vi.fn((key: string) => { values.delete(key) }),
  } as unknown as Storage
  vi.stubGlobal("window", { localStorage: storage })
})
afterEach(() => {
  hooks.cleanups.forEach(stop => stop())
  vi.unstubAllGlobals(); vi.restoreAllMocks()
})

describe("optional Accelerator progress cache", () => {
  it.each(["getter", "getItem", "setItem", "removeItem"] as const)("keeps navigation and acknowledged progress working when %s throws", async method => {
    const fail = () => { throw new DOMException("Storage unavailable", method === "setItem" ? "QuotaExceededError" : "SecurityError") }
    if (method === "getter") Object.defineProperty(window, "localStorage", { get: fail })
    else vi.mocked(storage[method]).mockImplementation(fail)
    const { controller, render, save } = setup()
    expect(controller.currentStep?.id).toBe("lesson:video")
    expect(await controller.markCurrentStepComplete()).toBe(true)
    expect(save).toHaveBeenCalledExactlyOnceWith("lesson", "lesson:video")
    expect(render().completedStepIds).toEqual(["lesson:video"])
    render().goNext()
    expect(render().currentStep?.id).toBe("lesson:resources")
  })

  it("retains the existing cache format and leaves notes/assignment drafts untouched", async () => {
    values.set("module-notes-draft-v1-org:actor-lesson", "unsaved notes")
    values.set("assignment-autosave-lesson", "legacy assignment")
    const { controller, render } = setup()
    await controller.markCurrentStepComplete(); render()
    render().goNext(); render()
    expect(values.get(positionKey)).toBe("1")
    expect(JSON.parse(values.get(completedKey)!)).toEqual(["lesson:video"])
    expect(values.get("module-notes-draft-v1-org:actor-lesson")).toBe("unsaved notes")
    expect(values.get("assignment-autosave-lesson")).toBe("legacy assignment")
  })

  it.each(["bad", "-1", "999"])("handles invalid or obsolete cached positions: %s", position => {
    values.set(positionKey, position)
    const { render } = setup()
    render()
    expect(render().currentStep).not.toBeNull()
  })

  it("ignores unacknowledged cached completion in live lessons", () => {
    values.set(positionKey, "1")
    values.set(completedKey, JSON.stringify(["lesson:video"]))
    const { controller } = setup()
    expect(controller.completedStepIds).toEqual([])
  })

  it("keeps server completions when optional storage is blocked", () => {
    Object.defineProperty(window, "localStorage", { get: () => { throw new Error("blocked") } })
    expect(setup({ initialCompletedStepIds: ["lesson:video"] }).controller.completedStepIds).toEqual(["lesson:video"])
  })

  it("does not acknowledge a failed server save when the cache also fails", async () => {
    vi.mocked(storage.setItem).mockImplementation(() => { throw new Error("full") })
    const { controller, render, save } = setup()
    save.mockResolvedValue({ error: "offline" })
    expect(await controller.markCurrentStepComplete()).toBe(false)
    expect(render().completedStepIds).toEqual([])
    expect(render().currentStep?.id).toBe("lesson:video")
  })

  it("ignores an older acknowledgement after organization switching", async () => {
    let finish!: (result: { ok: true }) => void
    const { controller, render, save, input } = setup()
    save.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const pending = controller.markCurrentStepComplete()
    input.storageKey = "another-org:actor"
    render()
    finish({ ok: true })
    expect(await pending).toBe(false)
    expect(render().completedStepIds).toEqual([])
  })
})
