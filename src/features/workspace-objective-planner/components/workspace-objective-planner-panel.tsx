"use client"
import { ObjectiveDecisionFields } from "./objective-decision-fields"
import { useId, useRef } from "react"
import SparklesIcon from "lucide-react/dist/esm/icons/sparkles"
import LoaderCircleIcon from "lucide-react/dist/esm/icons/loader-circle"
import { getReactGrabOwnerProps } from "@/components/dev/react-grab-surface"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useWorkspaceObjectivePlannerController } from "../hooks/use-workspace-objective-planner-controller"
import type { ObjectivePlan } from "../types"

export function WorkspaceObjectivePlannerPanel({
  plan,
  preview = false,
  canEdit,
  onSave,
  onClose,
}: {
  plan?: ObjectivePlan
  preview?: boolean
  canEdit: boolean
  onSave: (next: ObjectivePlan) => boolean
  onClose: () => void
}) {
  const id = useId()
  const titleRef = useRef<HTMLInputElement>(null)
  const controller = useWorkspaceObjectivePlannerController(plan, preview)
  const initial = useRef(JSON.stringify(controller.draft))
  const { draft, setDraft, pending } = controller
  const close = () => {
    if (
      JSON.stringify(draft) !== initial.current &&
      !window.confirm("Discard unsaved plan changes?")
    )
      return
    onClose()
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close()
      }}
    >
      <DialogContent
        className="max-h-[90dvh] overflow-y-auto overscroll-contain sm:max-w-xl"
        {...getReactGrabOwnerProps({
          ownerId: "workspace:objective-planner",
          component: "WorkspaceObjectivePlannerPanel",
          source:
            "src/features/workspace-objective-planner/components/workspace-objective-planner-panel.tsx",
          slot: "editor",
        })}
      >
        <DialogHeader>
          <DialogTitle>
            {plan ? "Edit objective" : "Plan an objective"}
          </DialogTitle>
          <DialogDescription>
            Build a connected plan for your canvas.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex min-w-0 flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (!canEdit || pending) return
            if (controller.save(onSave)) onClose()
            else titleRef.current?.focus()
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`${id}-title`}>Objective</FieldLabel>
              <Input
                ref={titleRef}
                id={`${id}-title`}
                name="objective"
                autoComplete="off"
                maxLength={160}
                className="min-h-11 text-base"
                value={draft.title}
                disabled={!canEdit || pending}
                onChange={(event) =>
                  setDraft({ ...draft, title: event.target.value })
                }
                placeholder="Launch a neighborhood training program…"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-summary`}>Planning notes</FieldLabel>
              <Textarea
                id={`${id}-summary`}
                name="summary"
                maxLength={1200}
                className="text-base"
                rows={3}
                value={draft.summary}
                disabled={!canEdit || pending}
                onChange={(event) =>
                  setDraft({ ...draft, summary: event.target.value })
                }
              />
            </Field>
          </FieldGroup>
          {!plan ? (
            <div className="flex flex-col items-start gap-2">
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                disabled={!canEdit || pending}
                onClick={() => {
                  if (!draft.title.trim()) titleRef.current?.focus()
                  void controller.generate()
                }}
              >
                {pending ? (
                  <LoaderCircleIcon
                    data-icon="inline-start"
                    className="motion-safe:animate-spin"
                  />
                ) : (
                  <SparklesIcon data-icon="inline-start" />
                )}
                {pending ? "Drafting…" : "Draft with AI"}
              </Button>
              <p className="text-muted-foreground text-xs">
                Sends your objective and notes to OpenAI. Review the suggested
                steps before adding them.
              </p>
            </div>
          ) : null}
          <ObjectiveDecisionFields
            value={draft.decision}
            onChange={(decision) => setDraft({ ...draft, decision })}
            disabled={!canEdit || pending}
          />
          <FieldGroup>
            {(
              [
                ["steps", "Steps", "One step per line, up to 12."],
                [
                  "tools",
                  "Tools / Connections",
                  "People or tools to explore, one per line, up to 6.",
                ],
                [
                  "channels",
                  "Social",
                  "Communication channels, one per line, up to 6.",
                ],
              ] as const
            ).map(([key, label, description]) => (
              <Field key={key}>
                <FieldLabel htmlFor={`${id}-${key}`}>{label}</FieldLabel>
                <Textarea
                  id={`${id}-${key}`}
                  name={key}
                  className="text-base"
                  rows={key === "steps" ? 4 : 2}
                  maxLength={key === "steps" ? 2000 : 1000}
                  value={draft[key].join("\n")}
                  disabled={!canEdit || pending}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      [key]: event.target.value.split("\n"),
                    })
                  }
                />
                <FieldDescription>{description}</FieldDescription>
              </Field>
            ))}
          </FieldGroup>
          {controller.origin === "ai" ? (
            <p className="text-muted-foreground text-xs">
              AI draft · check the details and adapt them to your organization.
            </p>
          ) : null}
          {controller.error ? (
            <Alert variant="destructive">
              <AlertDescription>{controller.error}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={close}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="min-h-11"
              disabled={!canEdit || pending}
            >
              {plan ? "Save plan" : "Add to canvas"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
