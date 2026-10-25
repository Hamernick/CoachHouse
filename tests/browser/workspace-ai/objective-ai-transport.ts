import type { AiPlanProposal, AiPlanTransport } from "../../../src/features/workspace-objectives/ai-plan-types"
import type { ObjectiveIslandData, ObjectiveIslandTransport } from "../../../src/features/workspace-objectives/island-types"
import { bindAiPlan } from "../../../src/features/workspace-objectives/lib/ai-plan-proposal"
import { draftFromPlan } from "../../../src/features/workspace-objectives/plan-types"
type FixtureRun = AiPlanProposal & { snapshots?: Record<string, string> }
const runs = (): Record<string, FixtureRun> => JSON.parse(localStorage.getItem("objective-ai-runs") || "{}")
const saveRun = (run: FixtureRun) => localStorage.setItem("objective-ai-runs", JSON.stringify({ ...runs(), [run.id]: run }))
export function objectiveAiTransport(read: () => ObjectiveIslandData, save: (data: ObjectiveIslandData) => void, savePlan: NonNullable<ObjectiveIslandTransport["savePlan"]>): AiPlanTransport {
  return {
    async quote() {
      const history = Object.values(runs())
      return { maximumCredits: 100, tariffVersion: "fictional", documents: [{ sectionId: "mission", title: "Mission", revision: "2026-10-22T12:00:00Z" }], account: { enabled: true, lots: [{ kind: "included", credits: 1000, spent: history.reduce((sum, run) => sum + (run.credits ?? 0), 0), reserved: history.filter(run => run.status === "running").length * 100, expiresAt: null }], history: [] } }
    },
    async generate(input) {
      const run: FixtureRun = { id: input.id, target: input.target, status: "running", content: null, credits: null, maxCredits: 100, application: null, revisionSourceRunId: input.reviseRunId, document: input.document }
      const original = input.target.plan ? read().planning?.plans.find(plan => plan.id === input.target.plan!.id) : undefined
      if (original) run.baseline = draftFromPlan(original, read().steps)
      saveRun(run)
      await new Promise(resolve => setTimeout(resolve, input.prompt.includes("slow") ? 1500 : 100))
      if (runs()[run.id].status === "canceled") return { proposal: runs()[run.id] }
      if (input.prompt.includes("fail revision")) { run.status = "failed"; run.credits = 0; saveRun(run); return { proposal: run } }
      const output = { title: input.reviseRunId ? "Revised community event" : "Community event proposal", summary: "A fictional plan for previewing the review flow.", assumptions: ["Venue availability has not been confirmed."], questions: ["Is a venue available?"],
        steps: [{ key: "venue", title: "Venue available?", kind: "decision" }, { key: "local", title: "Prepare the venue", kind: "action" }, { key: "online", title: "Prepare a virtual session", kind: "action" }],
        edges: [{ source: "venue", target: "local", label: "Yes" }, { source: "venue", target: "online", label: "No" }],
      }
      if (run.baseline) {
        output.title = "Updated saved plan"
        output.steps = [...run.baseline.steps.map((step, index) => ({ key: `saved_${index}`, title: index === 1 ? "Prepare accessible venue" : step.title, kind: run.baseline!.decisions?.some(item => item.stepId === step.id) ? "decision" : "action" })), { key: "materials", title: "Prepare materials", kind: "action" }]
        output.edges = run.baseline.edges.map(edge => ({ source: `saved_${run.baseline!.steps.findIndex(step => step.id === edge.source)}`, target: `saved_${run.baseline!.steps.findIndex(step => step.id === edge.target)}`, label: edge.label }))
      }
      run.content = bindAiPlan(JSON.stringify(output), run.id, input.target.objectiveId, () => crypto.randomUUID(), run.baseline)
      run.status = "succeeded"; run.credits = 4; saveRun(run)
      if (input.prompt.includes("interrupt")) throw new Error("Simulated lost response")
      return { proposal: run }
    },
    async read(id, target) {
      const run = runs()[id]
      if (!run || run.target.organizationId !== target.organizationId || run.target.userId !== target.userId || run.target.objectiveId !== target.objectiveId) throw new Error("This AI plan is unavailable.")
      return run
    },
    async stop(id) { const run = runs()[id]; if (run.status === "running") { run.status = "canceled"; run.credits = 0; saveRun(run) } },
    async apply(id, target) {
      const run = runs()[id]; if (run.application) return run.application
      if (read().objectives.find(item => item.id === target.objectiveId)?.updatedAt !== run.target.revision) throw new Error("This objective changed. Refresh before applying.")
      const result = await savePlan(target, run.content!.draft)
      if (!result.ok) throw new Error(result.error)
      run.snapshots = Object.fromEntries(read().steps.filter(step => run.content!.draft.steps.some(item => item.id === step.id)).map(step => [step.id, step.updatedAt]))
      run.application = { run_id: id, plan_id: run.content!.draft.id, saved_at: new Date().toISOString(), undone_at: null }; saveRun(run)
      if (sessionStorage.getItem("lose-ai-apply-response")) { sessionStorage.removeItem("lose-ai-apply-response"); throw new Error("Check status before retrying.") }
      return run.application
    },
    async undo(id) {
      const run = runs()[id]; if (run.application?.undone_at) return run.application
      const data = read(); const plan = data.planning!.plans.find(item => item.id === run.content!.draft.id)
      if (plan?.revision !== (run.baseline?.revision ?? 0) + 1 || Object.entries(run.snapshots!).some(([stepId, timestamp]) => data.steps.find(step => step.id === stepId)?.updatedAt !== timestamp)) throw new Error("This plan changed. Edit it manually to preserve newer work.")
      if (run.baseline) {
        const restored = { ...run.baseline, revision: plan.revision, steps: run.baseline.steps.map(step => ({ ...step, expectedUpdatedAt: data.steps.find(item => item.id === step.id)!.updatedAt })) }
        const result = await savePlan(run.target, restored)
        if (!result.ok) throw new Error(result.error)
        const restoredData = read(); restoredData.steps = restoredData.steps.filter(step => !run.snapshots![step.id] || run.baseline!.steps.some(old => old.id === step.id)); save(restoredData)
        run.application = { ...run.application!, undone_at: new Date().toISOString() }; saveRun(run); return run.application
      }
      data.planning!.plans = data.planning!.plans.filter(item => item.id !== id); data.steps = data.steps.filter(step => !run.snapshots![step.id]); save(data)
      run.application = { ...run.application!, undone_at: new Date().toISOString() }; saveRun(run); return run.application
    },
  }
}
