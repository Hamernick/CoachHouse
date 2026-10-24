"use client"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { AiPlanPreview } from "./ai-plan-preview"
import type { WorkspaceObjectiveRecord } from "../types"
import type { PlanDraft } from "../plan-types"
import type { AiPlanContent } from "../ai-plan-types"
export function AiPlanReview({ content, objective, baseline }: { baseline?: PlanDraft; content: AiPlanContent; objective: WorkspaceObjectiveRecord }) {
  const { draft } = content
  return <section aria-label="Proposed plan" className="space-y-3 rounded-2xl bg-muted/40 p-3 text-sm">
    <h3 className="font-medium">{draft.title}</h3><p className="whitespace-pre-wrap">{content.summary}</p>
    {baseline && <div aria-label="Plan changes" className="space-y-1 text-xs text-muted-foreground">
      {baseline.title !== draft.title && <p>{baseline.title} → {draft.title}</p>}
      <p>{draft.steps.filter(step => !baseline.steps.some(old => old.id === step.id)).length} added · {baseline.steps.filter(step => !draft.steps.some(next => next.id === step.id)).length} removed from this plan · {draft.steps.filter(step => baseline.steps.some(old => old.id === step.id && old.title !== step.title)).length} renamed</p>
      {baseline.decisions?.filter(choice => choice.selectedEdgeId && !draft.decisions?.some(next => next.stepId === choice.stepId && next.selectedEdgeId === choice.selectedEdgeId)).map(choice => <p key={choice.stepId}>Reset outcome: {baseline.steps.find(step => step.id === choice.stepId)?.title}</p>)}
      {baseline.steps.filter(step => !draft.steps.some(next => next.id === step.id)).map(step => <p key={step.id}>Remove from plan: {step.title}</p>)}
    </div>}
    {content.questions.length > 0 && <div><h4 className="font-medium">Needs information</h4><ul className="list-disc space-y-1 pl-4">{content.questions.map((question, index) => <li key={index}>{question}</li>)}</ul></div>}
    {content.assumptions.length > 0 && <div><h4 className="font-medium">Assumptions to review</h4><ul className="list-disc space-y-1 pl-4">{content.assumptions.map((assumption, index) => <li key={index}>{assumption}</li>)}</ul></div>}
    {draft.steps.length > 0 && <Tabs defaultValue="steps"><TabsList className="rounded-full"><TabsTrigger value="steps" className="rounded-full">Steps</TabsTrigger><TabsTrigger value="tree" className="rounded-full">Tree</TabsTrigger></TabsList>
    <TabsContent value="tree"><AiPlanPreview key={draft.id} draft={draft} objective={objective} /></TabsContent>
    <TabsContent value="steps"><ol className="space-y-2">{draft.steps.map(step => <li key={step.id} className="rounded-xl bg-background p-2">
      <span>{step.title}</span>{draft.decisions?.some(item => item.stepId === step.id) && <span className="ml-2 text-xs text-muted-foreground">Decision · {draft.edges.find(edge => edge.id === draft.decisions?.find(item => item.stepId === step.id)?.selectedEdgeId)?.label ?? "unresolved"}</span>}
      {draft.edges.filter(edge => edge.source === step.id).map(edge => <p key={edge.id} className="mt-1 text-xs text-muted-foreground">{edge.label && `${edge.label} → `}{draft.steps.find(item => item.id === edge.target)?.title}</p>)}
    </li>)}</ol></TabsContent></Tabs>}
  </section>
}
