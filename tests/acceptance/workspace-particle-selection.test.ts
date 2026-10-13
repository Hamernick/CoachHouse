import { createWorkspaceParticleConnectionHandlers } from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-particle-connection-handlers"
import { particleFlowStateChanges } from "@/features/workspace-particles/lib/particle-flow-changes"
import { nativeWorkspaceDragEvent } from "@/lib/workspace-canvas/drag-events"
import { afterEach, describe, expect, it, vi } from "vitest"
import { applyNodeChanges, type Node } from "@xyflow/react"
import { createParticlePositionPersistence } from "@/features/workspace-particles/lib/position-persistence"
import { createWorkspaceParticleFlowHandlers } from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-particle-flow-handlers"
import { resolveWorkspaceCanvasSelection } from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/use-workspace-canvas-selection"
import type { ParticleOperation } from "@/features/workspace-particles/types"
import { particle, ID } from "./fixtures/particle-fixtures"

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function writer() {
  const commit = vi.fn(async () => true)
  const settled = vi.fn()
  return {
    commit,
    settled,
    queue: createParticlePositionPersistence({ commit, settled }),
  }
}

describe("Particle position persistence", () => {
  it("debounces native keyboard bursts into one atomic group move", async () => {
    vi.useFakeTimers()
    const { queue, commit, settled } = writer()
    for (const x of [5, 10, 15]) {
      queue.record(particle(1), { x, y: 0 })
      queue.record(particle(2), { x, y: 20 })
      queue.schedule()
      await vi.advanceTimersByTimeAsync(100)
    }
    expect(commit).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(250)
    expect(commit).toHaveBeenCalledExactlyOnceWith({
      kind: "move_particles",
      mode: "manual",
      positions: [
        { id: ID(1), expectedRevision: 0, position: { x: 15, y: 0 } },
        { id: ID(2), expectedRevision: 0, position: { x: 15, y: 20 } },
      ],
    })
    expect(settled).toHaveBeenCalledOnce()
    expect(queue.has(ID(1))).toBe(false)
  })

  it("retains the starting revision if a collaborator changes the same record", async () => {
    const commit = vi.fn<
      (
        operation: Extract<ParticleOperation, { kind: "move_particles" }>
      ) => Promise<boolean>
    >(async () => false)
    const settled = vi.fn()
    const queue = createParticlePositionPersistence({ commit, settled })
    queue.record({ ...particle(1), revision: 2 }, { x: 5, y: 0 })
    queue.record({ ...particle(1), revision: 3 }, { x: 10, y: 0 })
    expect(queue.has(ID(1))).toBe(true)
    expect(await queue.flush()).toBe(false)
    expect(commit.mock.calls[0]?.[0].positions[0].expectedRevision).toBe(2)
    expect(queue.has(ID(1))).toBe(false)
    expect(settled).toHaveBeenCalledOnce()
  })

  it("cancels the key timer when a drag begins and flushes only once on drop", async () => {
    vi.useFakeTimers()
    const { queue, commit } = writer()
    queue.record(particle(1), { x: 5, y: 0 })
    queue.schedule()
    queue.record(particle(1), { x: 20, y: 0 })
    await vi.advanceTimersByTimeAsync(1000)
    expect(commit).not.toHaveBeenCalled()
    const first = queue.flush()
    expect(queue.flush()).toBe(first)
    await first
    await vi.advanceTimersByTimeAsync(1000)
    expect(commit).toHaveBeenCalledOnce()
  })

  it("does not queue locked, unchanged, or invalid positions", async () => {
    const { queue, commit } = writer()
    const record = particle(1)
    queue.record(record, record.position)
    queue.record({ ...record, locked: true }, { x: 100, y: 100 })
    queue.record(record, { x: Number.NaN, y: 100 })
    expect(await queue.flush()).toBe(true)
    expect(commit).not.toHaveBeenCalled()
  })

  it("releases transient coordinates after an unexpected transport failure", async () => {
    const settled = vi.fn()
    const queue = createParticlePositionPersistence({
      commit: async () => {
        throw new Error("offline")
      },
      settled,
    })
    queue.record(particle(1), { x: 10, y: 20 })
    expect(await queue.flush()).toBe(false)
    expect(queue.has(ID(1))).toBe(false)
    expect(settled).toHaveBeenCalledOnce()
  })

  it("cancels unsubmitted work on workspace change or unmount", async () => {
    vi.useFakeTimers()
    const { queue, commit, settled } = writer()
    queue.record(particle(1), { x: 10, y: 0 })
    queue.schedule()
    queue.cancel()
    await vi.advanceTimersByTimeAsync(1000)
    expect(commit).not.toHaveBeenCalled()
    queue.record(particle(1), { x: 20, y: 0 })
    const result = queue.flush()
    queue.cancel()
    expect(await result).toBe(false)
    expect(commit).not.toHaveBeenCalled()
    expect(settled).not.toHaveBeenCalled()
  })
})

function handlers() {
  const particles: Parameters<typeof createWorkspaceParticleFlowHandlers>[0] = {
    ids: new Set([ID(1), ID(2)]),
    selectedId: ID(1),
    onNodesChange: vi.fn(),
    select: vi.fn(() => true),
    move: vi.fn(async () => true),
    flow: { current: null },
  }
  const legacy: Parameters<typeof createWorkspaceParticleFlowHandlers>[1] = {
    onNodesChange: vi.fn(),
    onNodeClick: vi.fn(),
    onKeyDownCapture: vi.fn(),
    onNodeDragStop: vi.fn(),
    onSelectionDragStop: vi.fn(),
    onInit: vi.fn(),
  }
  return {
    particles,
    legacy,
    events: createWorkspaceParticleFlowHandlers(particles, legacy),
  }
}
const node = (id: string): Node => ({
  id,
  data: {},
  position: { x: 50, y: 50 },
})

describe("Particle canvas selection adapter", () => {
  it.each(["shiftKey", "metaKey", "ctrlKey"])(
    "leaves %s additive toggling to React Flow without opening another inspector",
    (modifier) => {
      const { particles, events } = handlers()
      const event = { [modifier]: true } as unknown as Parameters<
        typeof events.onNodeClick
      >[0]
      events.onNodeClick(event, node(ID(2)))
      expect(particles.select).not.toHaveBeenCalled()
    }
  )

  it("opens an ordinary card click without replacing the current group", () => {
    vi.stubGlobal("Element", class {})
    const { particles, events } = handlers()
    events.onNodeClick(
      { target: null } as unknown as Parameters<typeof events.onNodeClick>[0],
      node(ID(2))
    )
    expect(particles.select).toHaveBeenCalledWith(ID(2), {
      preserveSelection: true,
    })
  })

  it("splits selection changes without losing deselection or legacy cards", () => {
    const { particles, legacy, events } = handlers()
    const changes = [
      { type: "select" as const, id: ID(1), selected: false },
      { type: "select" as const, id: ID(2), selected: true },
      { type: "select" as const, id: "legacy", selected: true },
    ]
    events.onNodesChange(changes)
    expect(particles.onNodesChange).toHaveBeenCalledWith(changes.slice(0, 2))
    expect(legacy.onNodesChange).toHaveBeenCalledWith(changes.slice(2))
    const selected = applyNodeChanges(changes, [
      node(ID(1)),
      node(ID(2)),
      node("legacy"),
    ])
    expect(
      selected.filter((item) => item.selected).map((item) => item.id)
    ).toEqual([ID(2), "legacy"])
  })

  it("persists mixed group drops through each existing owner exactly once", () => {
    const { particles, legacy, events } = handlers()
    const moved = [node(ID(1)), node(ID(2)), node("legacy")]
    const event = {} as Parameters<typeof events.onNodeDragStop>[0]
    events.onNodeDragStop(event, moved[0], moved)
    expect(particles.move).toHaveBeenCalledExactlyOnceWith(moved.slice(0, 2))
    expect(legacy.onSelectionDragStop).toHaveBeenCalledExactlyOnceWith(
      event,
      moved.slice(2)
    )
    expect(legacy.onNodeDragStop).not.toHaveBeenCalled()
  })

  it("clears a selection before closing the inspector on a second Escape", () => {
    class Target {
      closest(selector: string) {
        return selector === ".react-flow__node" ? this : null
      }
      getAttribute() {
        return ID(1)
      }
    }
    vi.stubGlobal("Element", Target)
    const { particles, events } = handlers()
    let selected = [
      { ...node(ID(1)), selected: true },
      { ...node(ID(2)), selected: true },
    ]
    particles.flow.current = {
      getNodes: () => selected,
      setNodes: (update) => {
        selected = (
          typeof update === "function" ? update(selected) : update
        ).map((item) => ({ ...item, selected: item.selected === true }))
      },
    }
    const event = {
      target: new Target(),
      key: "Escape",
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as Parameters<typeof events.onKeyDownCapture>[0]
    events.onKeyDownCapture(event)
    expect(selected.every((item) => !item.selected)).toBe(true)
    expect(particles.select).not.toHaveBeenCalled()
    expect(event.stopPropagation).toHaveBeenCalledOnce()
    events.onKeyDownCapture(event)
    expect(particles.select).toHaveBeenCalledWith(null)
  })

  it("leaves nested controls and menus in charge of their keyboard events", () => {
    class Control {
      closest() {
        return this
      }
    }
    vi.stubGlobal("Element", Control)
    const { particles, legacy, events } = handlers()
    const event = {
      target: new Control(),
      key: "Escape",
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as Parameters<typeof events.onKeyDownCapture>[0]
    events.onKeyDownCapture(event)
    expect(event.stopPropagation).not.toHaveBeenCalled()
    expect(particles.select).not.toHaveBeenCalled()
    expect(legacy.onKeyDownCapture).not.toHaveBeenCalled()
  })

  it("supports desktop marquee while retaining touch and tutorial panning", () => {
    expect(resolveWorkspaceCanvasSelection(false, false)).toEqual({
      selectionOnDrag: true,
      panOnDrag: [1, 2],
    })
    for (const [touch, tutorial] of [
      [true, false],
      [false, true],
      [true, true],
    ]) {
      expect(resolveWorkspaceCanvasSelection(touch, tutorial)).toEqual({
        selectionOnDrag: false,
        panOnDrag: true,
      })
    }
  })
})

describe("React Flow v12 state boundary", () => {
  it("applies viewport replacement deselection without replacing domain data or positions", () => {
    const original = {
      ...node(ID(1)),
      selected: true,
      data: { title: "Keep this" },
    }
    const changes = particleFlowStateChanges([
      {
        type: "replace",
        id: original.id,
        item: {
          ...original,
          selected: false,
          position: { x: 999, y: 999 },
          data: { title: "Untrusted replacement" },
        },
      },
    ])
    const updated = applyNodeChanges<Node>(changes, [original])
    expect(updated[0]).toEqual({ ...original, selected: false })
    expect(
      particleFlowStateChanges([
        { type: "add", item: original },
        { type: "remove", id: original.id },
      ])
    ).toEqual([])
  })

  it("keeps measurements separate from fixed card dimensions", () => {
    const updated = applyNodeChanges<Node>(
      particleFlowStateChanges([
        {
          type: "dimensions",
          id: ID(1),
          dimensions: { width: 280, height: 413 },
        },
      ]),
      [node(ID(1))]
    )
    expect(updated[0].measured).toEqual({ width: 280, height: 413 })
    expect(updated[0].width).toBeUndefined()
    expect(updated[0].height).toBeUndefined()
  })

  it("routes native and React selection drag events to the same native event", () => {
    const native = new Event("mousemove") as MouseEvent
    expect(nativeWorkspaceDragEvent(native)).toBe(native)
    const selection = { nativeEvent: native } as Parameters<
      typeof nativeWorkspaceDragEvent
    >[0]
    expect(nativeWorkspaceDragEvent(selection)).toBe(native)
  })
})

describe("connection ownership dispatch", () => {
  it("routes domain connections to the Particle writer, preserves legacy links, supports tool bridges and rejects unknown endpoints", () => {
    const legacy = {
      onConnect: vi.fn(),
      isValidConnection: vi.fn(() => true),
      onEdgeDoubleClick: vi.fn(),
      onEdgeContextMenu: vi.fn(),
    }
    const connections = {
      preview: null,
      valid: vi.fn(() => true),
      connect: vi.fn(async () => true),
      disconnect: vi.fn(async () => true),
      insert: vi.fn(async () => true),
      undoChange: vi.fn(async () => true),
      message: null,
      canUndo: false,
    }
    const handlers = createWorkspaceParticleConnectionHandlers(
      { ids: new Set([ID(1), ID(2)]), connections, select: vi.fn(() => true) },
      legacy
    )
    const domain = {
      source: ID(1),
      target: ID(2),
      sourceHandle: "out",
      targetHandle: "in",
    }
    expect(handlers.isValidConnection(domain)).toBe(true)
    handlers.onConnect(domain)
    expect(connections.connect).toHaveBeenCalledExactlyOnceWith(domain)
    expect(legacy.onConnect).not.toHaveBeenCalled()
    const existing = { ...domain, source: "organization", target: "activity" }
    expect(handlers.isValidConnection(existing)).toBe(true)
    handlers.onConnect(existing)
    expect(legacy.onConnect).toHaveBeenCalledExactlyOnceWith(existing)
    for (const mixed of [
      { ...domain, source: "organization" },
      { ...domain, target: "organization" },
    ]) {
      expect(handlers.isValidConnection(mixed)).toBe(false)
      handlers.onConnect(mixed)
    }
    expect(connections.connect).toHaveBeenCalledTimes(1)
    for (const tool of [
      "organization-overview",
      "programs",
      "fiscal-sponsorship",
    ]) {
      for (const bridge of [
        { ...domain, source: tool },
        { ...domain, target: tool },
      ]) {
        expect(handlers.isValidConnection(bridge)).toBe(true)
        handlers.onConnect(bridge)
      }
    }
    const openMenu = vi.fn()
    const select = vi.fn(() => true)
    const menuHandlers = createWorkspaceParticleConnectionHandlers(
      { ids: new Set([ID(1), ID(2)]), connections, select },
      legacy,
      openMenu
    )
    const contextEvent = {
      clientX: 120,
      clientY: 80,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as Parameters<typeof menuHandlers.onEdgeContextMenu>[0]
    menuHandlers.onEdgeContextMenu(contextEvent, { ...domain, id: ID(20) })
    expect(openMenu).toHaveBeenCalledWith(ID(20), 120, 80)
    expect(select).not.toHaveBeenCalled()
    expect(connections.connect).toHaveBeenCalledTimes(7)
    expect(legacy.onConnect).toHaveBeenCalledTimes(1)
  })
})

describe("movement during an in-flight save", () => {
  it("keeps a newer active drag protected and saves it with our confirmed revision on drop", async () => {
    let finish!: (ok: boolean) => void
    let revision = 0
    const commit = vi
      .fn<
        (
          operation: Extract<ParticleOperation, { kind: "move_particles" }>
        ) => Promise<boolean>
      >()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve
          })
      )
      .mockResolvedValue(true)
    const queue = createParticlePositionPersistence({
      commit,
      settled: vi.fn(),
      getRevision: () => revision,
    })
    queue.record(particle(1), { x: 10, y: 20 })
    const first = queue.flush()
    await Promise.resolve()
    queue.gesture(ID(1), true)
    queue.record(particle(1), { x: 80, y: 90 })
    revision = 1
    finish(true)
    await first
    expect(queue.has(ID(1))).toBe(true)
    expect(commit).toHaveBeenCalledTimes(1)
    queue.gesture(ID(1), false)
    await queue.flush()
    expect(commit.mock.calls[1]?.[0].positions).toEqual([
      { id: ID(1), expectedRevision: 1, position: { x: 80, y: 90 } },
    ])
    expect(queue.has(ID(1))).toBe(false)
  })

  it("drains a second completed gesture after the first confirms, without parallel writes", async () => {
    let finish!: (ok: boolean) => void
    const commit = vi
      .fn<
        (
          operation: Extract<ParticleOperation, { kind: "move_particles" }>
        ) => Promise<boolean>
      >()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve
          })
      )
      .mockResolvedValue(true)
    const queue = createParticlePositionPersistence({
      commit,
      settled: vi.fn(),
      getRevision: () => 1,
    })
    queue.record(particle(1), { x: 10, y: 20 })
    const saved = queue.flush()
    await Promise.resolve()
    queue.record(particle(1), { x: 110, y: 120 })
    expect(queue.flush()).toBe(saved)
    expect(commit).toHaveBeenCalledTimes(1)
    finish(true)
    await saved
    expect(commit).toHaveBeenCalledTimes(2)
    expect(commit.mock.calls[1]?.[0].positions[0].position).toEqual({
      x: 110,
      y: 120,
    })
  })

  it("does not rebase newer movement after a failed save", async () => {
    let finish!: (ok: boolean) => void
    const commit = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          finish = resolve
        })
    )
    const queue = createParticlePositionPersistence({
      commit,
      settled: vi.fn(),
      getRevision: () => 99,
    })
    queue.record(particle(1), { x: 10, y: 20 })
    const saved = queue.flush()
    await Promise.resolve()
    queue.record(particle(1), { x: 100, y: 200 })
    queue.flush()
    finish(false)
    expect(await saved).toBe(false)
    expect(commit).toHaveBeenCalledTimes(1)
    expect(queue.has(ID(1))).toBe(false)
  })

  it("does not run legacy node reconciliation for Particle-only frames", () => {
    const { events, legacy } = handlers()
    events.onNodesChange([
      { type: "position", id: ID(1), dragging: true, position: { x: 5, y: 5 } },
    ])
    expect(legacy.onNodesChange).not.toHaveBeenCalled()
  })
})
