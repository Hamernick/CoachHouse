export type ObjectiveDecisionDraft = {
  question: string
  yesAction: string
  noAction: string
}
export type ObjectiveDecision = ObjectiveDecisionDraft & {
  choice: "yes" | "no" | null
  yesComplete: boolean
  noComplete: boolean
}
export type ObjectivePlanStep = { id: string; title: string; complete: boolean }
export type ObjectivePlan = {
  id: string
  title: string
  summary: string
  steps: ObjectivePlanStep[]
  tools: string[]
  channels: string[]
  decision?: ObjectiveDecision
  origin: "manual" | "ai"
}
export type ObjectivePlanPart =
  | "objective"
  | "decision"
  | "yes"
  | "no"
  | "steps"
  | "checklist"
  | "tools"
  | "social"
export type ObjectivePlanDraft = {
  decision?: ObjectiveDecisionDraft | null
  title: string
  summary: string
  steps: string[]
  tools: string[]
  channels: string[]
}
