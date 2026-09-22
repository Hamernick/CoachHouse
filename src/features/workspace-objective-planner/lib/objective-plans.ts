import type {
  ObjectivePlan,
  ObjectivePlanDraft,
  ObjectivePlanPart,
} from "../types"

export const OBJECTIVE_PLAN_LIMIT = 20
export const OBJECTIVE_STEP_LIMIT = 12
export const OBJECTIVE_PLAN_PARTS: ObjectivePlanPart[] = [
  "objective",
  "decision",
  "yes",
  "no",
  "steps",
  "checklist",
  "tools",
  "social",
]
export const OBJECTIVE_PART_LABELS: Record<ObjectivePlanPart, string> = {
  objective: "Objective",
  decision: "Decision",
  yes: "If yes",
  no: "If no",
  steps: "Steps",
  checklist: "To complete",
  tools: "Tools / Connections",
  social: "Social",
}
const ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/
const text = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : ""
export function objectiveLines(
  value: unknown,
  limit = OBJECTIVE_STEP_LIMIT
): string[] {
  return Array.isArray(value)
    ? value
        .slice(0, limit)
        .map((item) => text(item, 160))
        .filter(Boolean)
    : []
}
export function normalizeObjectivePlans(value: unknown): ObjectivePlan[] {
  if (!Array.isArray(value)) return []
  const ids = new Set<string>()
  return value.slice(0, OBJECTIVE_PLAN_LIMIT).flatMap((input) => {
    if (
      !input ||
      typeof input !== "object" ||
      typeof input.id !== "string" ||
      !ID.test(input.id) ||
      ids.has(input.id)
    )
      return []
    const title = text(input.title, 160)
    if (!title) return []
    ids.add(input.id)
    const d = input.decision
    const decision =
      d &&
      typeof d === "object" &&
      text(d.question, 160) &&
      text(d.yesAction, 160) &&
      text(d.noAction, 160)
        ? {
            question: text(d.question, 160),
            yesAction: text(d.yesAction, 160),
            noAction: text(d.noAction, 160),
            choice:
              d.choice === "yes" || d.choice === "no"
                ? (d.choice as "yes" | "no")
                : null,
            yesComplete: d.yesComplete === true,
            noComplete: d.noComplete === true,
          }
        : undefined
    const stepIds = new Set<string>()
    const steps = (Array.isArray(input.steps) ? input.steps : [])
      .slice(0, OBJECTIVE_STEP_LIMIT)
      .flatMap((step: unknown) => {
        if (!step || typeof step !== "object") return []
        const s = step as Record<string, unknown>
        if (
          typeof s.id !== "string" ||
          !ID.test(s.id) ||
          stepIds.has(s.id) ||
          !text(s.title, 160)
        )
          return []
        stepIds.add(s.id)
        return [
          {
            id: s.id,
            title: text(s.title, 160),
            complete: s.complete === true,
          },
        ]
      })
    return [
      {
        id: input.id,
        ...(decision ? { decision } : {}),
        title,
        summary: text(input.summary, 1200),
        steps,
        tools: objectiveLines(input.tools, 6),
        channels: objectiveLines(input.channels, 6),
        origin: input.origin === "ai" ? ("ai" as const) : ("manual" as const),
      },
    ]
  })
}
export function objectiveDraft(plan?: ObjectivePlan): ObjectivePlanDraft {
  return {
    title: plan?.title ?? "",
    decision: plan?.decision
      ? {
          question: plan.decision.question,
          yesAction: plan.decision.yesAction,
          noAction: plan.decision.noAction,
        }
      : null,
    summary: plan?.summary ?? "",
    steps: plan?.steps.map((step) => step.title) ?? [],
    tools: plan?.tools ?? [],
    channels: plan?.channels ?? [],
  }
}
export function saveObjectiveDraft(
  draft: ObjectivePlanDraft,
  id: string,
  origin: ObjectivePlan["origin"],
  previous?: ObjectivePlan
): ObjectivePlan {
  if (
    draft.steps.filter((step) => step.trim()).length > 12 ||
    draft.tools.filter((tool) => tool.trim()).length > 6 ||
    draft.channels.filter((channel) => channel.trim()).length > 6
  )
    throw new Error("Use up to 12 steps, 6 tools and 6 social channels.")
  if (
    [...draft.steps, ...draft.tools, ...draft.channels].some(
      (line) => line.trim().length > 160
    )
  )
    throw new Error(
      "Keep each step, tool and social channel under 160 characters."
    )
  const d = draft.decision
  if (
    d &&
    (d.question.trim() || d.yesAction.trim() || d.noAction.trim()) &&
    (!d.question.trim() || !d.yesAction.trim() || !d.noAction.trim())
  )
    throw new Error(
      "Add a decision question and both possible actions, or leave all three empty."
    )
  if (
    d &&
    [d.question, d.yesAction, d.noAction].some(
      (value) => value.trim().length > 160
    )
  )
    throw new Error("Keep the decision and its actions under 160 characters.")
  const sameDecision =
    d &&
    previous?.decision &&
    d.question === previous.decision.question &&
    d.yesAction === previous.decision.yesAction &&
    d.noAction === previous.decision.noAction
  const decision = d
    ? {
        ...d,
        choice: sameDecision ? previous!.decision!.choice : null,
        yesComplete: sameDecision ? previous!.decision!.yesComplete : false,
        noComplete: sameDecision ? previous!.decision!.noComplete : false,
      }
    : undefined
  const consumed = new Set<string>()
  const steps = objectiveLines(draft.steps.filter((line) => line.trim())).map(
    (title, index) => {
      // Completion survives only unchanged text, including duplicate-title steps.
      const old = previous?.steps.find(
        (step) => step.title === title && !consumed.has(step.id)
      )
      if (old) {
        consumed.add(old.id)
        return old
      }
      let stepId = `step-${index + 1}`
      while (
        previous?.steps.some((step) => step.id === stepId) ||
        consumed.has(stepId)
      )
        stepId += "x"
      consumed.add(stepId)
      return { id: stepId, title, complete: false }
    }
  )
  const [plan] = normalizeObjectivePlans([
    {
      ...draft,
      tools: draft.tools.filter((line) => line.trim()),
      channels: draft.channels.filter((line) => line.trim()),
      decision,
      id,
      origin,
      steps,
    },
  ])
  if (!plan) throw new Error("Add an objective before saving.")
  return plan
}
export function setObjectiveStepComplete(
  plan: ObjectivePlan,
  stepId: string,
  complete: boolean
): ObjectivePlan {
  return {
    ...plan,
    steps: plan.steps.map((step) =>
      step.id === stepId ? { ...step, complete } : step
    ),
  }
}

export function objectivePlanParts(plan: ObjectivePlan): ObjectivePlanPart[] {
  return OBJECTIVE_PLAN_PARTS.filter(
    (part) => plan.decision || !["decision", "yes", "no"].includes(part)
  )
}
export function chooseObjectiveDecision(
  plan: ObjectivePlan,
  choice: "yes" | "no" | null
): ObjectivePlan {
  return plan.decision
    ? { ...plan, decision: { ...plan.decision, choice } }
    : plan
}
export function completeDecisionAction(
  plan: ObjectivePlan,
  branch: "yes" | "no",
  complete: boolean
): ObjectivePlan {
  return plan.decision
    ? {
        ...plan,
        decision: {
          ...plan.decision,
          [branch === "yes" ? "yesComplete" : "noComplete"]: complete,
        },
      }
    : plan
}
