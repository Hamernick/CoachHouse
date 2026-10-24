import { createElement, type ComponentProps, type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { DragEndEvent } from "@dnd-kit/core"
import { ID, NOW, particle } from "./fixtures/particle-fixtures"

const drag = vi.hoisted(() => ({ end: null as null | ((event: DragEndEvent) => void), cancel: null as null | (() => void) }))
vi.mock("@dnd-kit/core", async importOriginal => ({
  ...await importOriginal<typeof import("@dnd-kit/core")>(),
  DndContext: ({ children, onDragEnd, onDragCancel }: { children: ReactNode; onDragEnd: typeof drag.end; onDragCancel: typeof drag.cancel }) => {
    drag.end = onDragEnd
    drag.cancel = onDragCancel
    return children
  },
}))
vi.mock("@/features/workspace-objectives/components/plan-particle-picker", () => ({ PlanParticlePicker: () => null }))
import { ParticlePlanBranch } from "@/features/workspace-objectives/components/particle-plan-branch"

type Props = ComponentProps<typeof ParticlePlanBranch>
function render(overrides: Partial<Props> = {}) {
  const plan = { id: ID(20), title: "Workshop", revision: 4, particleIds: [ID(2), ID(3), ID(4)] }
  const base = particle(1, "objective")
  if (base.type !== "objective") throw new Error("Expected objective fixture")
  const objective: Props["objective"] = { ...base, data: { ...base.data, planning: { plans: [plan], proposals: [] } } }
  const props = {
    objective, plan, userId: ID(90),
    controls: { canEdit: true, pending: false, error: null, selectedId: null, graph: { particles: [objective, particle(2), particle(3), particle(4)] } } as Props["controls"],
    actions: { owner: true, savePlan: vi.fn().mockResolvedValue(true), update: vi.fn().mockResolvedValue(true) } as unknown as Props["actions"],
    ...overrides,
  }
  const markup=renderToStaticMarkup(createElement(ParticlePlanBranch, props))
  return {...props,markup}
}
function drop(from: number, to: number | null) {
  drag.end!({ active: { id: ID(from) }, over: to === null ? null : { id: ID(to) } } as DragEndEvent)
}
beforeEach(() => { drag.end = null; drag.cancel = null })

describe("plan drag sorting", () => {
  it("saves moving the first particle after the last without editing particle data", () => {
    const props = render()
    drop(2, 4)
    expect(props.actions.savePlan).toHaveBeenCalledExactlyOnceWith(props.objective, { ...props.plan, particleIds: [ID(3), ID(4), ID(2)] }, undefined)
    expect(props.actions.update).not.toHaveBeenCalled()
  })
  it("saves moving the last particle before the first", () => {
    const props = render()
    drop(4, 2)
    expect(props.actions.savePlan).toHaveBeenCalledWith(props.objective, { ...props.plan, particleIds: [ID(4), ID(2), ID(3)] }, undefined)
  })
  it.each([[2, 2], [2, null], [99, 2], [2, 99]] as const)("does not save unchanged, outside, or unknown drops (%s, %s)", (from, to) => {
    const props = render()
    drop(from, to)
    expect(props.actions.savePlan).not.toHaveBeenCalled()
  })
  it("does not save a canceled gesture", () => {
    const props = render()
    drag.cancel!()
    expect(props.actions.savePlan).not.toHaveBeenCalled()
  })
  it.each(["pending", "readOnly", "notOwner"])("blocks reordering when %s", state => {
    const initial = render()
    const props = render({ controls: { ...initial.controls, pending: state === "pending", canEdit: state !== "readOnly" }, actions: { ...initial.actions, owner: state !== "notOwner" } })
    drop(2, 4)
    expect(props.actions.savePlan).not.toHaveBeenCalled()
  })
  it("reorders an author's proposal without modifying the approved plan", () => {
    const initial = render()
    const proposal = { id: ID(30), planId: initial.plan.id, baseRevision: 4, title: initial.plan.title, particleIds: initial.plan.particleIds, authorId: ID(90), createdAt: NOW, status: "pending" as const }
    const objective = { ...initial.objective, data: { ...initial.objective.data, planning: { plans: [initial.plan], proposals: [proposal] } } }
    const props = render({ objective, proposal, actions: { ...initial.actions, owner: false } })
    drop(2, 4)
    expect(props.actions.savePlan).not.toHaveBeenCalled()
    expect(props.actions.update).toHaveBeenCalledExactlyOnceWith(objective, { plans: [initial.plan], proposals: [{ ...proposal, particleIds: [ID(3), ID(4), ID(2)] }] }, undefined)
  })
})


describe("plan branch presentation",()=>{
  it("shows named conditions and unknown choices without marking alternatives complete",()=>{
    const initial=render()
    const decision=particle(2,"decision")
    const controls={...initial.controls,graph:{...initial.controls.graph!,particles:[initial.objective,decision,particle(3),particle(4)]}}
    const plan={...initial.plan,links:[{source:ID(2),target:ID(3),outcome:"yes"},{source:ID(2),target:ID(4),outcome:"no"}]}
    const result=render({controls,plan})
    expect(result.markup).toContain("Needs decision")
    expect(result.markup).toContain("If ")
    expect(result.markup).toContain("Yes")
    expect(result.markup).not.toContain("Not selected")
    if(decision.type!=="decision")throw Error()
    const chosen=render({plan,controls:{...controls,graph:{...controls.graph,particles:controls.graph.particles.map(item=>item.id===decision.id?{...decision,data:{...decision.data,selectedOutcome:"yes"}}:item)}}})
    expect(chosen.markup).toContain("Not selected")
    expect(chosen.markup).not.toContain("Needs decision")
  })
})
