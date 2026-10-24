import { createElement, type ComponentProps } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type * as ButtonModule from "@/components/ui/button"
import type * as InputModule from "@/components/ui/input"
import type * as CheckboxModule from "@/components/ui/checkbox"
import { ParticleDecisionEditor } from "@/features/workspace-particles/components/particle-decision-editor"
import { ParticleInspector } from "@/features/workspace-particles/components/particle-inspector"
import { PARTICLE_PREVIEWS } from "@/features/workspace-particles/components/particle-preview"
import {
  createDecisionOutcome,
  decisionCriteriaOrder,
  decisionOutcomeRemovalReason,
  moveDecisionItem,
  removeDecisionOutcome,
  replaceDecisionCriterion,
  selectDecisionOutcome,
  type DecisionParticle,
} from "@/features/workspace-particles/lib/particle-decision"
import { particleSchema } from "@/features/workspace-particles/lib/particle-schema"
import { particleConnectionsToFlow } from "@/features/workspace-particles/lib/particle-flow-adapters"
import { applyParticleBatch } from "@/features/workspace-particles/lib/graph-operations"
import {
  batch,
  edge,
  graph,
  particle,
  ID,
  NOW,
} from "./fixtures/particle-fixtures"

const controls = vi.hoisted(() => ({
  buttons: new Map<string, ComponentProps<typeof ButtonModule.Button>>(),
  inputs: new Map<string, ComponentProps<typeof InputModule.Input>>(),
  checks: [] as ComponentProps<typeof CheckboxModule.Checkbox>[],
}))
vi.mock("@/components/ui/button", async (original) => {
  const actual = await original<typeof ButtonModule>()
  return {
    ...actual,
    Button: (props: ComponentProps<typeof ButtonModule.Button>) => {
      const label =
        props["aria-label"] ??
        (typeof props.children === "string" ? props.children : "")
      if (label) controls.buttons.set(label, props)
      return createElement(actual.Button, props)
    },
  }
})
vi.mock("@/components/ui/input", async (original) => {
  const actual = await original<typeof InputModule>()
  return {
    ...actual,
    Input: (props: ComponentProps<typeof InputModule.Input>) => {
      controls.inputs.set(String(props.value), props)
      return createElement(actual.Input, props)
    },
  }
})
vi.mock("@/components/ui/checkbox", async (original) => {
  const actual = await original<typeof CheckboxModule>()
  return {
    ...actual,
    Checkbox: (props: ComponentProps<typeof CheckboxModule.Checkbox>) => {
      controls.checks.push(props)
      return createElement(actual.Checkbox, props)
    },
  }
})
beforeEach(() => {
  controls.buttons.clear()
  controls.inputs.clear()
  controls.checks.length = 0
})

function decision(count = 2): DecisionParticle {
  const value = particle(1, "decision")
  if (value.type !== "decision") throw new Error("Invalid fixture")
  return {
    ...value,
    data: {
      criteria: Array.from({ length: count }, (_, index) => ({
        id: ID(10 + index),
        title: `Criterion ${index + 1}`,
        order: index,
        status: "backlog",
        particleId: ID(2),
      })),
      outcomes: [
        { id: "yes", label: "Ready" },
        { id: "no", label: "Not yet" },
        { id: "review", label: "Review" },
      ],
      selectedOutcome: null,
    },
  }
}
const branch = () =>
  edge(50, 1, 2, {
    relationship: "decision_outcome",
    outcome: "yes",
    sourceHandle: "outcome:yes",
  })

describe("Decision editing and persistence", () => {
  it("creates schema-valid stable IDs and enforces outcome limits and declared selection", () => {
    const value = decision()
    value.data.outcomes.push(createDecisionOutcome(ID(99)))
    expect(particleSchema.safeParse(value).success).toBe(true)
    for (const outcomes of [
      value.data.outcomes.slice(0, 1),
      [value.data.outcomes[0], value.data.outcomes[0]],
      Array.from({ length: 13 }, (_, i) => createDecisionOutcome(ID(100 + i))),
    ]) {
      expect(
        particleSchema.safeParse({
          ...value,
          data: { ...value.data, outcomes },
        }).success
      ).toBe(false)
    }
    expect(
      particleSchema.safeParse({
        ...value,
        data: { ...value.data, selectedOutcome: "missing" },
      }).success
    ).toBe(false)
  })
  it("edits and reorders criteria while retaining linked resources and sibling identity", () => {
    const value = decision()
    const changed = replaceDecisionCriterion(value, {
      ...value.data.criteria[0],
      title: "Venue confirmed",
      status: "done",
    })
    expect(changed.data.criteria[0]).toMatchObject({
      id: ID(10),
      particleId: ID(2),
      status: "done",
    })
    expect(changed.data.criteria[1]).toBe(value.data.criteria[1])
    const moved = moveDecisionItem(changed, "criteria", ID(10), 1)
    expect(
      decisionCriteriaOrder(moved.data.criteria).map((item) => item.id)
    ).toEqual([ID(11), ID(10)])
    expect(moved.data.criteria.map((item) => item.order)).toEqual([0, 1])
    expect(moveDecisionItem(value, "criteria", ID(10), -1)).toBe(value)
    expect(moveDecisionItem(value, "outcomes", "missing", 1)).toBe(value)
    expect(value.data.criteria[0].status).toBe("backlog")
  })
  it("selects or clears a result independently of criteria and ignores unknown outcomes", () => {
    const value = decision()
    const chosen = selectDecisionOutcome(value, "yes")
    expect(chosen.data.criteria).toBe(value.data.criteria)
    expect(chosen.status).toBe(value.status)
    expect(selectDecisionOutcome(chosen, null).data.selectedOutcome).toBeNull()
    expect(selectDecisionOutcome(value, "missing")).toBe(value)
  })
  it("blocks connected outcomes and minimum-size removal, clearing only an unconnected removed selection", () => {
    const value = selectDecisionOutcome(decision(), "yes")
    expect(decisionOutcomeRemovalReason(value, "yes", [branch()])).toContain(
      "Disconnect"
    )
    expect(removeDecisionOutcome(value, "yes", [branch()])).toBe(value)
    const removed = removeDecisionOutcome(value, "yes", [])
    expect(removed.data.selectedOutcome).toBeNull()
    expect(removed.data.criteria).toBe(value.data.criteria)
    expect(removed.data.outcomes).toHaveLength(2)
    expect(removeDecisionOutcome(removed, "no", [])).toBe(removed)
    expect(
      removeDecisionOutcome(value, "review", []).data.selectedOutcome
    ).toBe("yes")
  })
  it("persists renamed/reordered outcomes and selection without changing rails; inverse restores the full decision", async () => {
    const value = decision()
    const renamed = {
      ...value,
      data: {
        ...value.data,
        outcomes: value.data.outcomes.map((item) =>
          item.id === "yes" ? { ...item, label: "Approved" } : item
        ),
      },
    }
    const changed = selectDecisionOutcome(
      moveDecisionItem(renamed, "outcomes", "yes", 1),
      "yes"
    )
    const saved = await applyParticleBatch(
      graph([value, particle(2)], [branch()]),
      batch(100, [
        { kind: "put_particle", particle: changed, expectedRevision: 0 },
      ]),
      NOW
    )
    expect(saved.ok).toBe(true)
    if (!saved.ok) return
    expect(saved.value.graph.connections).toEqual([branch()])
    expect(saved.value.graph.particles[0].data).toEqual(changed.data)
    const rails = particleConnectionsToFlow(saved.value.graph)
    expect(rails[0]).toMatchObject({
      label: "Approved",
      style: { strokeWidth: 2.5, opacity: 1 },
    })
    const restored = await applyParticleBatch(
      saved.value.graph,
      {
        ...batch(101, saved.value.inverse, saved.value.graph.revision),
        requireExactRevision: true,
      },
      NOW
    )
    expect(restored.ok).toBe(true)
    if (restored.ok)
      expect(restored.value.graph.particles[0].data).toEqual(value.data)
  })
  it("rejects a raced connection removal and stale record write without altering the graph", async () => {
    const value = decision()
    const current = graph([value, particle(2)], [branch()])
    const removed = removeDecisionOutcome(value, "yes", [])
    const invalid = await applyParticleBatch(
      current,
      batch(102, [
        { kind: "put_particle", particle: removed, expectedRevision: 0 },
      ]),
      NOW
    )
    expect(invalid.ok).toBe(false)
    const stale = await applyParticleBatch(
      current,
      batch(103, [
        {
          kind: "put_particle",
          particle: selectDecisionOutcome(value, "no"),
          expectedRevision: 9,
        },
      ]),
      NOW
    )
    expect(stale).toMatchObject({ ok: false, code: "conflict" })
    expect(current.particles[0]).toEqual(value)
    expect(current.connections).toEqual([branch()])
  })
})

describe("Decision editor and canvas controls", () => {
  it("adds valid draft records through the editor without selecting an outcome", () => {
    const change = vi.fn()
    renderToStaticMarkup(
      createElement(ParticleDecisionEditor, {
        particle: decision(0),
        connections: [],
        disabled: false,
        onChange: change,
      })
    )
    for (const label of ["Add criterion", "Add outcome"]) {
      const click = controls.buttons.get(label)?.onClick
      if (!click) throw new Error(`Missing ${label} control`)
      click({} as Parameters<typeof click>[0])
    }
    expect(change).toHaveBeenCalledTimes(2)
    for (const [draft] of change.mock.calls) {
      expect(particleSchema.safeParse(draft).success).toBe(true)
      expect(draft.data.selectedOutcome).toBeNull()
    }
    expect(change.mock.calls[0][0].data.criteria[0].status).toBe("backlog")
    expect(change.mock.calls[1][0].data.outcomes).toHaveLength(4)
  })
  it("uses the existing inspector form and explains linked outcome protection", () => {
    const html = renderToStaticMarkup(
      createElement(ParticleInspector, {
        particle: decision(),
        connections: [branch()],
        editable: true,
        pending: false,
        onSave: vi.fn(async () => true),
        onClose: vi.fn(),
        onDirtyChange: vi.fn(),
      })
    )
    for (const label of [
      "Criteria",
      "Outcomes",
      "Selected outcome",
      "Save changes",
      "Disconnect this outcome",
      "no work runs automatically",
    ])
      expect(html).toContain(label)
    expect(controls.buttons.get("Remove outcome 1")?.disabled).toBe(true)
    expect(controls.buttons.get("Remove outcome 3")?.disabled).toBe(false)
  })
  it("edits a label through the rendered control without changing its outcome ID", () => {
    const value = decision()
    const change = vi.fn()
    renderToStaticMarkup(
      createElement(ParticleDecisionEditor, {
        particle: value,
        connections: [branch()],
        disabled: false,
        onChange: change,
      })
    )
    const handler = controls.inputs.get("Ready")?.onChange
    if (!handler) throw new Error("Missing outcome input")
    handler({ target: { value: "Approved" } } as Parameters<typeof handler>[0])
    expect(change.mock.calls[0][0].data.outcomes[0]).toEqual({
      id: "yes",
      label: "Approved",
    })
    expect(change.mock.calls[0][0].data.criteria).toBe(value.data.criteria)
  })
  it("paginates criteria and disables all mutation controls in read-only mode", () => {
    const html = renderToStaticMarkup(
      createElement(ParticleDecisionEditor, {
        particle: decision(20),
        connections: [],
        disabled: true,
        onChange: vi.fn(),
      })
    )
    expect(html).toContain("Page 1 of 3")
    expect(html).not.toContain("Backlog")
    expect(html).not.toContain("Criterion 1 status")
    expect(html).not.toContain("Criterion 9")
    expect(controls.buttons.get("Move outcome 1 down")?.disabled).toBe(true)
    expect(controls.buttons.get("Remove criterion 1")?.disabled).toBe(true)
    expect(controls.inputs.get("Ready")?.disabled).toBe(true)
    expect(controls.buttons.get("Next criteria")?.disabled).toBe(false)
  })
  it("shows four criterion rows and independently updates criteria or the chosen branch", () => {
    const value = decision(6)
    delete value.size // Legacy cards retain their existing preview.
    const onEdit = vi.fn()
    const html = renderToStaticMarkup(
      createElement(PARTICLE_PREVIEWS.decision, {
        particle: value,
        editable: true,
        onEdit,
        onOpen: vi.fn(),
      })
    )
    expect(html).toContain("0 of 6 criteria met")
    expect(html).toContain("2 more criteria")
    expect(controls.checks).toHaveLength(4)
    controls.checks[0].onCheckedChange?.(true)
    expect(onEdit.mock.calls[0][0].data.criteria[0].status).toBe("done")
    expect(onEdit.mock.calls[0][0].data.selectedOutcome).toBeNull()
    const click = controls.buttons.get("Ready")?.onClick
    if (!click) throw new Error("Missing outcome button")
    click({} as Parameters<typeof click>[0])
    expect(onEdit.mock.calls[1][0].data.selectedOutcome).toBe("yes")
    expect(onEdit.mock.calls[1][0].data.criteria).toBe(value.data.criteria)
  })
})
