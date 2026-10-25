import { describe, expect, it } from "vitest"
import { planApplicability, planProgress, clearRemovedChoices } from "@/features/workspace-objectives/lib/plan-progress"
import { planDraftSchema, type ObjectivePlan } from "@/features/workspace-objectives/plan-types"
import type { ObjectiveStep } from "@/features/workspace-objectives/island-types"
const plan: ObjectivePlan = { id: "p", objectiveId: "o", title: "Event", revision: 1, stepIds: ["choice", "a", "b", "join"],
  edges: [{ id: "yes", source: "choice", target: "a", label: "Venue" }, { id: "no", source: "choice", target: "b", label: "Online" }, { id: "a-join", source: "a", target: "join", label: "" }, { id: "b-join", source: "b", target: "join", label: "" }],
  decisions: [{ stepId: "choice", selectedEdgeId: null }] }
const steps = plan.stepIds.map(id => ({ id, title: id, objectiveId: "o", status: "done", editable: true, order: 0, updatedAt: "now" }) as ObjectiveStep)
function choose(id: string | null): ObjectivePlan { return { ...plan, decisions: [{ stepId: "choice", selectedEdgeId: id }] } }
describe("explicit plan decision applicability", () => {
  it("does not invent outcomes from completed step status; unknown descendants cannot count toward completion", () => {
    const result = planProgress([plan], steps)
    expect(result.active.map(step => step.id)).toEqual(["choice"])
    expect(result.completed).toHaveLength(0)
    expect(result.waiting).toBe(3)
  })
  it("activates only the chosen branch and its convergence, retaining historical completion when choices change", () => {
    expect([...planApplicability([choose("yes")]).steps]).toEqual([["choice", "active"], ["a", "active"], ["b", "inactive"], ["join", "active"]])
    expect(planProgress([choose("no")], steps).completed.map(step => step.id)).toEqual(["choice", "b", "join"])
    expect(planProgress([plan], steps).completed).toHaveLength(0)
    expect(steps.every(step => step.status === "done")).toBe(true)
  })
  it("propagates choices across related plans while independent roots remain active", () => {
    const linked = { ...plan, id: "linked", stepIds: ["linked-step"], decisions: [], edges: [] }
    const first = { ...choose("yes"), edges: [...plan.edges, { id: "next", source: "b", target: "linked-step", label: "" }] }
    const independent = { ...linked, id: "independent", stepIds: ["independent-step"] }
    const result = planApplicability([first, linked, independent])
    expect(result.steps.get("linked-step")).toBe("inactive")
    expect(result.steps.get("independent-step")).toBe("active")
    expect(result.edges.get("next")).toBe("inactive")
  })
  it("does not activate a nested decision until its incoming branch is selected", () => {
    const nested = { ...choose("no"), stepIds: [...plan.stepIds, "child-a", "child-b"], decisions: [...choose("no").decisions!, { stepId: "a", selectedEdgeId: "nested-yes" }], edges: [...plan.edges,
      { id: "nested-yes", source: "a", target: "child-a", label: "Yes" }, { id: "nested-no", source: "a", target: "child-b", label: "No" }] }
    expect(planApplicability([nested]).steps.get("child-a")).toBe("inactive")
    expect(planApplicability([{ ...nested, decisions: [choose("yes").decisions![0], { stepId: "a", selectedEdgeId: null }] }]).steps.get("child-a")).toBe("waiting")
  })
  it("clears a removed selection without changing other plan data", () => {
    expect(clearRemovedChoices({ ...choose("yes"), edges: [] }).decisions![0].selectedEdgeId).toBeNull()
  })
  it("rejects an unbound decision at the action schema boundary", () => {
    const id = "00000000-0000-4000-8000-000000000001"
    expect(planDraftSchema.safeParse({ id, objectiveId: id, revision: 0, title: "Invalid", steps: [], edges: [], decisions: [{ stepId: id, selectedEdgeId: null }] }).success).toBe(false)
  })
})
