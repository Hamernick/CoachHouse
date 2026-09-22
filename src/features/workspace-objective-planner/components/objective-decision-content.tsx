"use client"
import { useId } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { ObjectiveDecision } from "../types"
export function ObjectiveDecisionContent({
  decision,
  part,
  canEdit,
  onDecision,
}: {
  decision: ObjectiveDecision
  part: "decision" | "yes" | "no"
  canEdit: boolean
  onDecision: (choice: "yes" | "no" | null, complete?: boolean) => void
}) {
  const id = useId()
  if (part === "decision")
    return (
      <>
        <p className="text-sm font-medium break-words">{decision.question}</p>
        <ToggleGroup
          type="single"
          variant="outline"
          value={decision.choice ?? ""}
          disabled={!canEdit}
          aria-label="Decision outcome"
          onValueChange={(value) =>
            onDecision(value === "yes" || value === "no" ? value : null)
          }
        >
          <ToggleGroupItem value="yes" className="min-h-11">
            Yes
          </ToggleGroupItem>
          <ToggleGroupItem value="no" className="min-h-11">
            No
          </ToggleGroupItem>
        </ToggleGroup>
        <p className="text-muted-foreground text-xs">
          {decision.choice
            ? `Following the ${decision.choice} path.`
            : "Choose an outcome to follow its action."}
        </p>
      </>
    )
  const selected = decision.choice === part
  return (
    <>
      <p className="text-muted-foreground text-xs">
        {selected ? "Chosen path" : "Alternative path"}
      </p>
      <div className="flex min-h-11 min-w-0 items-start gap-2">
        <Checkbox
          id={id}
          className="mt-3 shrink-0"
          checked={part === "yes" ? decision.yesComplete : decision.noComplete}
          disabled={!canEdit || !selected}
          onCheckedChange={(value) => onDecision(part, value === true)}
        />
        <label
          htmlFor={id}
          className="flex min-h-11 min-w-0 flex-1 items-center py-2 text-sm break-words"
        >
          {part === "yes" ? decision.yesAction : decision.noAction}
        </label>
      </div>
    </>
  )
}
