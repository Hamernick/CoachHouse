import { createElement, useContext, type ComponentProps } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { animate } from "motion/react"
import {
  createParticleDragGesture,
  particleDragAnchor,
  particleDragOrigin,
} from "@/features/workspace-particles/lib/particle-drag-gesture"
import { ParticleLibraryDragProvider } from "@/features/workspace-particles/components/particle-library-drag-provider"
import {
  ParticleLibraryDragContext,
  type ParticleLibraryDragController,
} from "@/features/workspace-particles/components/particle-library-drag-context"
import { useParticleCreate } from "@/features/workspace-particles/hooks/use-particle-create"
import { useParticlePresetPlacement } from "@/features/workspace-particles/hooks/use-particle-preset-placement"
import { PARTICLE_PRESETS } from "@/features/workspace-particles/lib/particle-presets"
import { particle, ID, WORKSPACE } from "./fixtures/particle-fixtures"
import { ParticleLibraryCardStack } from "@/features/workspace-particles/components/particle-library-card-stack"
import {
  createParticleStackPlacement,
  readParticleStackReducedMotion,
  subscribeParticleStackReducedMotion,
} from "@/features/workspace-particles/lib/particle-stack"

vi.mock("motion/react", () => ({
  useReducedMotion: () => true,
  useMotionValue: (initial: number) => {
    let value = initial
    return {
      get: () => value,
      set: (next: number) => {
        value = next
      },
    }
  },
  animate: vi.fn((target: { set?: (value: number) => void }, value: number) => {
    if (typeof value === "number") target.set?.(value)
    return Object.assign(Promise.resolve(), { stop: vi.fn() })
  }),
  motion: { div: "div" },
}))
afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})
const point = { x: 20, y: 30 }
const callbacks = () => ({
  origin: point,
  begin: vi.fn(() => true),
  move: vi.fn(),
  drop: vi.fn(),
  cancel: vi.fn(),
})
const tick = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve()
}

describe("Particle library pointer gesture", () => {
  it("keeps clicks and accidental movements out of placement", () => {
    const actions = callbacks(),
      gesture = createParticleDragGesture(actions)
    gesture.move({ x: 23, y: 32 })
    gesture.end(point)
    gesture.move({ x: 100, y: 100 })
    expect(actions.begin).not.toHaveBeenCalled()
    expect(actions.drop).not.toHaveBeenCalled()
  })
  it("begins once, tracks freely and commits once on release", () => {
    const actions = callbacks(),
      gesture = createParticleDragGesture(actions)
    for (let x = 30; x < 1000; x++) gesture.move({ x, y: 100 })
    expect(actions.begin).toHaveBeenCalledTimes(1)
    expect(actions.drop).not.toHaveBeenCalled()
    gesture.end(point)
    gesture.end(point)
    gesture.cancel()
    expect(actions.drop).toHaveBeenCalledTimes(1)
    expect(actions.cancel).not.toHaveBeenCalled()
  })
  it("cancels without placement and ignores late pointer events", () => {
    const actions = callbacks(),
      gesture = createParticleDragGesture(actions)
    gesture.move({ x: 100, y: 100 })
    gesture.cancel()
    gesture.end(point)
    gesture.move({ x: 200, y: 200 })
    expect(actions.cancel).toHaveBeenCalledTimes(1)
    expect(actions.drop).not.toHaveBeenCalled()
    expect(actions.move).toHaveBeenCalledTimes(1)
  })
  it("rejects a second/disabled gesture without moving or writing", () => {
    const actions = { ...callbacks(), begin: vi.fn(() => false) }
    const gesture = createParticleDragGesture(actions)
    gesture.move({ x: 100, y: 100 })
    gesture.move({ x: 200, y: 200 })
    gesture.end(point)
    expect(actions.begin).toHaveBeenCalledTimes(1)
    expect(actions.move).not.toHaveBeenCalled()
    expect(actions.drop).not.toHaveBeenCalled()
  })
  it("preserves the grab offset and clamps out-of-bounds anchors", () => {
    const rect = { left: 10, top: 10, width: 100, height: 80 }
    expect(
      particleDragOrigin({ x: 300, y: 200 }, particleDragAnchor(point, rect))
    ).toEqual({ x: 290, y: 180 })
    expect(particleDragAnchor({ x: -100, y: 400 }, rect)).toEqual({
      x: 0,
      y: 80,
    })
  })
})

function dragHarness(
  confirmed: boolean | Promise<boolean> = true,
  validHit = true
) {
  const source = {
    style: { opacity: "0.8" },
    getBoundingClientRect: () => ({
      left: 10,
      top: 10,
      width: 280,
      height: 160,
    }),
  } as HTMLElement
  const node = {
    style: { opacity: "" },
    getBoundingClientRect: () => ({
      left: 500,
      top: 200,
      width: 280,
      height: 160,
    }),
  } as HTMLElement
  const flow = { contains: () => validHit }
  const canvas = {
    querySelector: (selector: string) =>
      selector === ".react-flow" ? flow : node,
  } as unknown as HTMLElement
  vi.stubGlobal("document", { elementFromPoint: () => ({}) })
  vi.stubGlobal("CSS", { escape: (value: string) => value })
  const onPlace = vi.fn(async () => confirmed)
  let controller: ParticleLibraryDragController | null = null
  function Harness() {
    controller = useContext(ParticleLibraryDragContext)
    return null
  }
  const providerProps: ComponentProps<typeof ParticleLibraryDragProvider> = {
    canvas,
    onPlace,
    children: createElement(Harness),
  }
  renderToStaticMarkup(createElement(ParticleLibraryDragProvider, providerProps))
  if (!controller) throw new Error("Missing drag controller")
  const actions: ParticleLibraryDragController = controller
  const item = {
    request: {
      kind: "existing" as const,
      drag: { kind: "particle" as const, workspaceId: WORKSPACE, id: ID(1) },
    },
    title: "Example",
    preview: createElement("div", null, "Existing card renderer"),
  }
  return { actions, onPlace, source, item }
}

describe("Particle drag persistence and reduced motion", () => {
  it("attaches to a registered source target without placing a canvas copy", async () => {
    const { actions, source, item, onPlace } = dragHarness()
    const target = { contains: () => true, setAttribute: vi.fn(), removeAttribute: vi.fn() } as unknown as HTMLElement
    const attach = vi.fn(async (_item: unknown) => true)
    const onPlacement = vi.fn()
    const unregister = actions.registerDropTarget!(target, attach)
    actions.begin({ ...item, onPlacement }, source, point)
    actions.move(point)
    expect(target.setAttribute).toHaveBeenCalledWith("data-library-drag-over", "true")
    actions.drop(point)
    actions.drop(point)
    await tick()
    expect(attach).toHaveBeenCalledTimes(1)
    expect(attach.mock.calls[0]?.[0]).toMatchObject({ request: item.request })
    expect(onPlace).not.toHaveBeenCalled()
    expect(onPlacement).not.toHaveBeenCalled()
    expect(source.style.opacity).toBe("0.8")
    expect(target.removeAttribute).toHaveBeenCalled()
    unregister()
    actions.begin(item, source, point)
    actions.drop(point)
    await tick()
    expect(onPlace).toHaveBeenCalledTimes(1)
  })

  it("hands off to the optimistic canvas card while the save is still unresolved", async () => {
    let confirm: (value: boolean) => void = () => {}
    const pending = new Promise<boolean>((resolve) => {
      confirm = resolve
    })
    const { actions, source, item, onPlace } = dragHarness(pending)
    const onPlacement = vi.fn()
    actions.begin({ ...item, onPlacement }, source, point)
    actions.drop({ x: 500, y: 200 })
    await tick()
    expect(onPlace).toHaveBeenCalledTimes(1)
    // The source/preview have already handed off; the server promise is pending.
    expect(source.style.opacity).toBe("0.8")
    expect(onPlacement.mock.calls).toEqual([["placed"]])
    confirm(true)
    await tick()
    expect(onPlace).toHaveBeenCalledTimes(1)
    expect(onPlacement.mock.calls).toEqual([["placed"], ["confirmed"]])
  })

  it("tracks hundreds of movements without writing, placing once at the grab-adjusted screen point", async () => {
    const { actions, source, item, onPlace } = dragHarness()
    expect(actions.begin(item, source, point)).toBe(true)
    expect(animate).not.toHaveBeenCalled() // Reduced motion has no lift/tilt.
    for (let x = 100; x < 600; x++) actions.move({ x, y: 200 })
    expect(onPlace).not.toHaveBeenCalled()
    actions.drop({ x: 500, y: 200 })
    actions.drop({ x: 500, y: 200 })
    await tick()
    expect(onPlace).toHaveBeenCalledTimes(1)
    expect(onPlace).toHaveBeenCalledWith(item.request, { x: 490, y: 180 })
    expect(source.style.opacity).toBe("0.8")
  })
  it("returns cancelled/outside drops without any save", async () => {
    const { actions, source, item, onPlace } = dragHarness(true, false)
    const onPlacement = vi.fn()
    actions.begin({ ...item, onPlacement }, source, point)
    actions.drop({ x: 500, y: 200 })
    await tick()
    expect(onPlace).not.toHaveBeenCalled()
    expect(onPlacement).not.toHaveBeenCalled()
    expect(source.style.opacity).toBe("0.8")
  })
  it("recovers a rejected save without a duplicate write or lost library item", async () => {
    const { actions, source, item, onPlace } = dragHarness(false)
    const onPlacement = vi.fn()
    actions.begin({ ...item, onPlacement }, source, point)
    actions.drop({ x: 500, y: 200 })
    await tick()
    expect(onPlace).toHaveBeenCalledTimes(1)
    expect(onPlacement).toHaveBeenCalledWith("failed")
    expect(source.style.opacity).toBe("0.8")
    expect(actions.begin(item, source, point)).toBe(true)
    actions.cancel()
  })

  it("does not replay a save or strand the drag if a decorative animation fails", async () => {
    const { actions, source, item, onPlace } = dragHarness()
    actions.begin(
      {
        ...item,
        onPlacement: () => {
          throw new Error("Animation unavailable")
        },
      },
      source,
      point
    )
    actions.drop({ x: 500, y: 200 })
    await tick()
    expect(onPlace).toHaveBeenCalledTimes(1)
    expect(source.style.opacity).toBe("0.8")
  })
})

describe("Reusable Particle library card stack", () => {
  it.each([true, false])(
    "preserves one real preview and optional decorative back cards: %s",
    (enabled) => {
      const stackProps: ComponentProps<typeof ParticleLibraryCardStack> = {
        enabled,
        children: () => createElement("button", null, "Real preview"),
      }
      const html = renderToStaticMarkup(
        createElement(ParticleLibraryCardStack, stackProps)
      )
      expect(html.match(/Real preview/g)).toHaveLength(1)
      expect(html.match(/data-particle-stack-back/g) ?? []).toHaveLength(
        enabled ? 2 : 0
      )
      expect(html.match(/aria-hidden="true"/g) ?? []).toHaveLength(
        enabled ? 2 : 0
      )
      expect(html.match(/inert=""/g) ?? []).toHaveLength(enabled ? 2 : 0)
      expect(html).not.toContain("h-72")
    }
  )

  it.each([
    ["placed", "confirmed"],
    ["confirmed", "placed"],
  ] as const)(
    "advances once for a handoff/receipt in order %j",
    (...phases) => {
      const advance = vi.fn(),
        reset = vi.fn()
      const notify = createParticleStackPlacement(advance, reset)
      phases.forEach(notify)
      notify("confirmed")
      expect(advance).toHaveBeenCalledTimes(1)
      expect(reset).not.toHaveBeenCalled()
    }
  )

  it("restores an optimistic promotion on failure and ignores late callbacks", () => {
    const advance = vi.fn(),
      reset = vi.fn()
    const notify = createParticleStackPlacement(advance, reset)
    notify("placed")
    notify("failed")
    notify("failed")
    notify("confirmed")
    expect(advance).toHaveBeenCalledTimes(1)
    expect(reset).toHaveBeenCalledTimes(1)
  })

  it("keeps the front card for a rejected placement without any promotion", () => {
    const advance = vi.fn(),
      reset = vi.fn()
    const notify = createParticleStackPlacement(advance, reset)
    notify("failed")
    notify("placed")
    expect(advance).not.toHaveBeenCalled()
    expect(reset).not.toHaveBeenCalled()
  })

  it("tracks reduced-motion preference changes with subscription cleanup", () => {
    const media = {
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }
    vi.stubGlobal("window", { matchMedia: () => media })
    const notify = vi.fn()
    const unsubscribe = subscribeParticleStackReducedMotion(notify)
    expect(readParticleStackReducedMotion()).toBe(false)
    media.matches = true
    expect(readParticleStackReducedMotion()).toBe(true)
    expect(media.addEventListener).toHaveBeenCalledWith("change", notify)
    unsubscribe()
    expect(media.removeEventListener).toHaveBeenCalledWith("change", notify)
  })
})

describe("Preset placement identity and explicit canvas positions", () => {
  it("uses the requested drop position without the default cascade or opening an editor", async () => {
    let create: ReturnType<typeof useParticleCreate> | undefined
    const add = vi.fn(async () => true)
    vi.stubGlobal("document", { querySelector: vi.fn() })
    function Harness() {
      create = useParticleCreate({
        add,
        count: 3,
        dirty: { current: false },
        flow: { current: null },
      })
      return null
    }
    renderToStaticMarkup(createElement(Harness))
    const prepared = particle(1)
    await create?.(prepared.type, prepared.title, prepared, {
      position: { x: 42, y: -12 },
      inspect: false,
    })
    expect(add).toHaveBeenCalledWith(
      prepared.type,
      prepared.title,
      { x: 42, y: -12 },
      prepared,
      { inspect: false }
    )
    expect(document.querySelector).not.toHaveBeenCalled()
  })
  it("reuses the preset identity until confirmation so a retry is safe", () => {
    let placement: ReturnType<typeof useParticlePresetPlacement> | undefined
    function Harness() {
      placement = useParticlePresetPlacement(WORKSPACE)
      return null
    }
    renderToStaticMarkup(createElement(Harness))
    const first = placement?.prepare(PARTICLE_PRESETS[0])
    const retry = placement?.prepare(PARTICLE_PRESETS[0])
    expect(first?.id).toBe(retry?.id)
    expect(first?.workspaceId).toBe(WORKSPACE)
  })
})
