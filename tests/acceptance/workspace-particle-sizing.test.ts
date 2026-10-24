import {
  reconcileParticleNode,
  particleResizeChanges,
} from "@/features/workspace-particles/lib/particle-node-state"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { useParticleResize } from "@/features/workspace-particles/hooks/use-particle-resize"
import { ParticleChecklist } from "@/features/workspace-particles/components/particle-preview"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  PARTICLE_SIZES,
  PARTICLE_SIZE_NAMES,
  particleFamilyDimensions,
  particleResizeDimensions,
  nearestParticleSize,
  particleSizeStyle,
  particleSizeTokens,
  resolveParticleResize,
} from "@/features/workspace-particles/lib/particle-size"
import { createImageParticle } from "@/features/workspace-particles/lib/particle-image"
import { particleCardOperation } from "@/features/workspace-particles/lib/particle-card-actions"
import { createParticle } from "@/features/workspace-particles/lib/particle-registry"
import { particleSchema } from "@/features/workspace-particles/lib/particle-schema"
import { applyParticleBatch } from "@/features/workspace-particles/lib/graph-operations"
import { graph, batch, ID, WORKSPACE, NOW } from "./fixtures/particle-fixtures"
const make = () =>
  createParticle("activity", { id: ID(1), workspaceId: WORKSPACE, now: NOW })

describe("Particle size families", () => {
  it("fits every photo family to landscape, portrait and panoramic originals", () => {
    for (const [width, height] of [
      [1600, 900],
      [900, 1600],
      [3000, 300],
      [300, 3000],
    ]) {
      const photo = createImageParticle(
        WORKSPACE,
        "Photo",
        { kind: "image", fileId: ID(50), width, height, alt: "" },
        { x: 100, y: 200 },
        ID(1),
        NOW
      )
      if (photo.type !== "activity") throw new Error("Invalid image fixture")
      let previousWidth = 0
      for (const size of PARTICLE_SIZE_NAMES) {
        const dimensions = particleFamilyDimensions(photo, size)
        // Subtract the title strip and borders: the image area has no spare space.
        expect((dimensions.width - 2) / (dimensions.height - 38)).toBeCloseTo(
          width / height
        )
        expect(dimensions.width).toBeGreaterThan(previousWidth)
        expect(particleSizeStyle({ ...photo, size }, 280)).toEqual(dimensions)
        expect(
          nearestParticleSize(dimensions, PARTICLE_SIZE_NAMES, photo)
        ).toBe(size)
        previousWidth = dimensions.width
      }
      const start = particleFamilyDimensions(photo, "large")
      expect(
        resolveParticleResize(
          start,
          { ...start, width: start.width + 2 },
          PARTICLE_SIZE_NAMES,
          photo
        )
      ).toBeNull()
      delete photo.size
      photo.width = 333
      expect(particleSizeStyle(photo, 280)).toEqual({
        width: 333,
        height: (331 * height) / width + 38,
      })
    }
  })
  it("keeps photo geometry during native resize without touching measurements or other cards", () => {
    const photo = createImageParticle(
      WORKSPACE,
      "Photo",
      { kind: "image", fileId: ID(50), width: 1600, height: 900, alt: "" },
      { x: 100, y: 200 },
      ID(1),
      NOW
    )
    const other = { ...make(), id: ID(2) }
    const dimensions = { width: 650, height: 400 }
    const changes = particleResizeChanges(
      [
        {
          type: "dimensions",
          id: photo.id,
          dimensions,
          setAttributes: "width",
          resizing: true,
        },
        {
          type: "dimensions",
          id: other.id,
          dimensions,
          setAttributes: true,
          resizing: true,
        },
        { type: "dimensions", id: photo.id, dimensions },
      ],
      new Map([
        [photo.id, photo],
        [other.id, other],
      ])
    )
    expect(changes[0]).toMatchObject({
      dimensions: { width: 650, height: 402.5 },
      setAttributes: true,
    })
    expect(changes[1]).toMatchObject({ dimensions })
    expect(changes[2]).toEqual({ type: "dimensions", id: photo.id, dimensions })
    expect(particleResizeDimensions(other, dimensions)).toBe(dimensions)
    expect(
      resolveParticleResize(
        particleFamilyDimensions(photo, "large"),
        particleFamilyDimensions(photo, "extra_large"),
        PARTICLE_SIZE_NAMES,
        photo
      )
    ).toBe("extra_large")
    expect(photo.size).toBe("large")
    expect(photo.position).toEqual({ x: 100, y: 200 })
  })
  it("derives dimensions from one grid contract", () => {
    expect(PARTICLE_SIZES.extra_large).toMatchObject({
      width: 816,
      height: 400,
    })
    expect(PARTICLE_SIZES.medium).toMatchObject({ width: 400, height: 192 })
    expect(particleSizeTokens({ cell: 100, gap: 10 }).large).toMatchObject({
      width: 210,
      height: 210,
    })
  })
  it("ignores accidental movement and chooses only supported presets", () => {
    expect(
      resolveParticleResize(
        { width: 400, height: 192 },
        { width: 408, height: 200 },
        ["medium", "large"]
      )
    ).toBeNull()
    expect(
      nearestParticleSize({ width: 192, height: 192 }, ["medium", "large"])
    ).toBe("medium")
    expect(
      resolveParticleResize(
        { width: 400, height: 192 },
        { width: 390, height: 380 },
        ["medium", "large"]
      )
    ).toBe("large")
  })
  it("keeps legacy width and auto-height until explicit resizing", () => {
    const legacy = make()
    delete legacy.size
    legacy.width = 333
    expect(particleSchema.safeParse(legacy).success).toBe(true)
    expect(particleSizeStyle(legacy, 280)).toEqual({ width: 333 })
    const operation = particleCardOperation(
      legacy,
      "family_large",
      () => ID(2),
      NOW
    )
    expect(operation?.kind).toBe("put_particle")
    if (operation?.kind !== "put_particle") throw new Error("Missing operation")
    expect(operation.particle.size).toBe("large")
    expect(operation.particle.width).toBeUndefined()
    expect(operation.particle.position).toEqual(legacy.position)
  })
  it("rejects unsupported sizes at the action and persistence boundaries", () => {
    const calendar = createParticle("calendar", {
      id: ID(1),
      workspaceId: WORKSPACE,
      now: NOW,
    })
    expect(
      particleCardOperation(calendar, "family_small", () => ID(2), NOW)
    ).toBeNull()
    expect(
      particleSchema.safeParse({ ...calendar, size: "small" }).success
    ).toBe(false)
    expect(
      particleCardOperation(
        { ...make(), locked: true },
        "family_large",
        () => ID(2),
        NOW
      )
    ).toBeNull()
  })
  it("creates one reversible resize operation without moving neighbors", async () => {
    const source = make()
    const neighbor = { ...make(), id: ID(2), position: { x: 800, y: 100 } }
    const original = graph([source, neighbor])
    const operation = particleCardOperation(
      source,
      "family_large",
      () => ID(3),
      NOW
    )
    if (!operation) throw new Error("Missing operation")
    const result = await applyParticleBatch(
      original,
      batch(100, [operation]),
      NOW
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.graph.particles[0].size).toBe("large")
    expect(result.value.graph.particles[1]).toEqual(neighbor)
    expect(result.value.inverse).toHaveLength(1)
    const undone = await applyParticleBatch(
      result.value.graph,
      batch(101, result.value.inverse, result.value.graph.revision),
      NOW
    )
    expect(undone.ok).toBe(true)
    if (undone.ok)
      expect(undone.value.graph.particles[0].size).toBe(source.size)
  })
})

afterEach(() => vi.unstubAllGlobals())
describe("Resize session", () => {
  function controller(options: { dirty?: boolean; save?: boolean } = {}) {
    let current = graph([make()])
    const action = vi.fn(
      async (
        _id: string,
        action: Parameters<typeof particleCardOperation>[1]
      ) => {
        const operation = particleCardOperation(
          current.particles[0],
          action,
          () => ID(2),
          NOW
        )
        if (options.save === false) return false
        if (operation?.kind === "put_particle")
          current = { ...current, particles: [operation.particle] }
        return true
      }
    )
    let control: ReturnType<typeof useParticleResize> | undefined
    function Harness() {
      control = useParticleResize({
        session: {
          graph: current,
          getCurrentGraph: () => current,
          editable: true,
        },
        dirty: { current: options.dirty ?? false },
        blocked: false,
        setNodes: vi.fn(),
        action,
      })
      return null
    }
    renderToStaticMarkup(createElement(Harness))
    if (!control) throw new Error("No resize controller")
    vi.stubGlobal("matchMedia", () => ({ matches: true }))
    return {
      control,
      action,
      current: () => current,
      conflict: () => {
        current = {
          ...current,
          particles: [{ ...current.particles[0], revision: 1 }],
        }
      },
    }
  }
  it("keeps intermediate dimensions local and commits once on release", async () => {
    const { control, action, current } = controller()
    expect(control.begin(ID(1), { width: 400, height: 192 })).toBe(true)
    control.preview(ID(1), { width: 410, height: 310 })
    control.preview(ID(1), { width: 400, height: 390 })
    expect(action).not.toHaveBeenCalled()
    await control.finish(ID(1), { width: 400, height: 390 })
    expect(action).toHaveBeenCalledExactlyOnceWith(ID(1), "family_large")
    expect(current().particles[0].size).toBe("large")
  })
  it("preserves saved size on cancellation, conflict and failed save", async () => {
    for (const mode of ["cancel", "conflict", "failed"] as const) {
      const state = controller({ save: mode !== "failed" })
      state.control.begin(ID(1), { width: 400, height: 192 })
      if (mode === "conflict") state.conflict()
      await state.control.finish(
        ID(1),
        { width: 400, height: 400 },
        mode === "cancel"
      )
      expect(state.current().particles[0].size).toBe("medium")
      if (mode !== "failed") expect(state.action).not.toHaveBeenCalled()
    }
  })
  it("blocks resize while an inspector has unsaved changes", () => {
    expect(
      controller({ dirty: true }).control.begin(ID(1), {
        width: 400,
        height: 192,
      })
    ).toBe(false)
  })
  it("shows essential progress in small cards and more actual steps at large sizes", () => {
    const original = make()
    if (original.type !== "activity") throw new Error("Wrong fixture")
    original.data.steps = Array.from({ length: 8 }, (_, index) => ({
      id: ID(30 + index),
      title: `Step ${index}`,
      status: "backlog",
      order: index,
    }))
    const render = (size: "small" | "medium" | "large") =>
      renderToStaticMarkup(
        createElement(ParticleChecklist, {
          particle: { ...original, size },
          editable: true,
          onEdit: vi.fn(),
          onOpen: vi.fn(),
        })
      )
    expect(render("small")).toContain("0 of 8 complete")
    expect(render("small")).not.toContain("Step 0")
    expect(render("medium")).toContain("Step 1")
    expect(render("medium")).not.toContain("Step 2")
    expect(render("large")).toContain("Step 5")
  })
})

describe("Size adapter", () => {
  it("reconstructs dimensions after reload without moving a saved Particle", () => {
    const particle = { ...make(), position: { x: 155, y: 287 } }
    const node = reconcileParticleNode({
      particle,
      selectedId: null,
      movable: true,
      resizing: false,
      keepPosition: false,
      data: { particle, editable: true, onOpen: vi.fn(), onEdit: vi.fn() },
    })
    expect(node.style).toEqual({ width: 400, height: 192 })
    expect(node.position).toEqual({ x: 155, y: 287 })
    const during = reconcileParticleNode({
      old: { ...node, width: 430, height: 305 },
      particle,
      selectedId: null,
      movable: true,
      resizing: true,
      keepPosition: true,
      data: node.data,
    })
    expect(during.width).toBe(430)
    expect(during.height).toBe(305)
    expect(during.data.particle.size).toBe("medium")
  })
})
