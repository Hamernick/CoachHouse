"use client"
import { ObjectiveDecisionContent } from "./objective-decision-content"
import { useId } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { getReactGrabOwnerProps } from "@/components/dev/react-grab-surface"
import type { ObjectivePlan, ObjectivePlanPart } from "../types"

export function ObjectivePlanContent({
  plan,
  part,
  canEdit,
  onComplete,
  onDecision,
}: {
  plan: ObjectivePlan
  part: ObjectivePlanPart
  canEdit: boolean
  onComplete: (stepId: string, complete: boolean) => void
  onDecision: (choice: "yes" | "no" | null, complete?: boolean) => void
}) {
  const id = useId()
  const done = plan.steps.filter((step) => step.complete).length
  return (
    <div
      className="flex h-full min-w-0 flex-col gap-3 overflow-auto p-4"
      {...getReactGrabOwnerProps({
        ownerId: `workspace:objective-plan:${plan.id}:${part}`,
        component: "ObjectivePlanContent",
        source:
          "src/features/workspace-objective-planner/components/objective-plan-content.tsx",
        slot: part,
      })}
    >
      {plan.decision &&
      (part === "decision" || part === "yes" || part === "no") ? (
        <ObjectiveDecisionContent
          decision={plan.decision}
          part={part}
          canEdit={canEdit}
          onDecision={onDecision}
        />
      ) : part === "objective" ? (
        <>
          <p className="text-sm font-medium break-words">{plan.title}</p>
          <p className="text-muted-foreground text-sm break-words whitespace-pre-wrap">
            {plan.summary || "Add planning notes to describe the outcome."}
          </p>
          <p className="text-muted-foreground text-xs tabular-nums">
            {done} / {plan.steps.length} steps complete
          </p>
        </>
      ) : part === "steps" || part === "checklist" ? (
        <>
          {part === "checklist" ? (
            <p className="text-muted-foreground text-xs tabular-nums">
              {done} / {plan.steps.length} complete
            </p>
          ) : null}
          {plan.steps.length ? (
            <ol className="flex flex-col gap-1">
              {plan.steps.map((step, index) => (
                <li
                  key={step.id}
                  className="flex min-h-11 min-w-0 items-start gap-2"
                >
                  {part === "checklist" ? (
                    <>
                      <Checkbox
                        id={`${id}-${step.id}`}
                        className="mt-3 shrink-0"
                        checked={step.complete}
                        disabled={!canEdit}
                        onCheckedChange={(value) =>
                          onComplete(step.id, value === true)
                        }
                      />
                      <label
                        htmlFor={`${id}-${step.id}`}
                        className="flex min-h-11 min-w-0 flex-1 items-center py-2 text-sm break-words"
                      >
                        {step.title}
                      </label>
                    </>
                  ) : (
                    <>
                      <span className="text-muted-foreground pt-2 text-xs tabular-nums">
                        {index + 1}
                      </span>
                      <span className="min-w-0 py-2 text-sm break-words">
                        {step.title}
                      </span>
                    </>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-muted-foreground text-sm">
              Add the steps needed to reach this objective.
            </p>
          )}
        </>
      ) : (
        <>
          {(part === "tools" ? plan.tools : plan.channels).length ? (
            <ul className="flex flex-col gap-3">
              {(part === "tools" ? plan.tools : plan.channels).map(
                (entry, index) => (
                  <li key={index} className="text-sm break-words">
                    {entry}
                  </li>
                )
              )}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">
              {part === "tools"
                ? "Add tools and connections to explore."
                : "Add channels to reach your community."}
            </p>
          )}
        </>
      )}
    </div>
  )
}
