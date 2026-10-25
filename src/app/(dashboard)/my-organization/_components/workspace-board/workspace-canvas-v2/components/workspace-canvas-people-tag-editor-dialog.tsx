"use client"

import { useWorkspaceEditorStatus } from "@/components/workspace/workspace-editor-status"

import { useEffect, useState } from "react"
import LoaderCircleIcon from "lucide-react/dist/esm/icons/loader-circle"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
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
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldLegend,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  DEFAULT_ORGANIZATION_PEOPLE_TAG_COLOR,
  ORGANIZATION_PEOPLE_TAG_COLOR_OPTIONS,
  normalizePersonTag,
  type OrganizationPeopleTag,
  type OrganizationPeopleTagColor,
} from "@/lib/people/tags"

export function WorkspacePeopleTagEditorDialog({
  initialLabel = "",
  onDelete,
  onOpenChange,
  onSave,
  open,
  tag,
}: {
  initialLabel?: string
  onDelete?: () => Promise<boolean>
  onOpenChange: (open: boolean) => void
  onSave: (input: {
    color: OrganizationPeopleTagColor
    label: string
  }) => Promise<boolean>
  open: boolean
  tag?: OrganizationPeopleTag
}) {
  const [label, setLabel] = useState(tag?.label ?? initialLabel)
  const [color, setColor] = useState<OrganizationPeopleTagColor>(
    tag?.color ?? DEFAULT_ORGANIZATION_PEOPLE_TAG_COLOR
  )
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const normalizedLabel = normalizePersonTag(label)
  useWorkspaceEditorStatus({
    label: "People tag",
    dirty:
      open &&
      (label !== (tag?.label ?? initialLabel) ||
        color !== (tag?.color ?? DEFAULT_ORGANIZATION_PEOPLE_TAG_COLOR)),
    pending: open && isSaving,
  })

  useEffect(() => {
    if (!open) return
    setLabel(tag?.label ?? initialLabel)
    setColor(tag?.color ?? DEFAULT_ORGANIZATION_PEOPLE_TAG_COLOR)
  }, [initialLabel, open, tag])

  const handleSave = async () => {
    if (!normalizedLabel || isSaving) return
    setIsSaving(true)
    const saved = await onSave({ color, label: normalizedLabel })
    setIsSaving(false)
    if (saved) onOpenChange(false)
  }

  const handleDelete = async () => {
    if (!onDelete || isDeleting) return
    setIsDeleting(true)
    const deleted = await onDelete()
    setIsDeleting(false)
    if (deleted) onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isSaving && !isDeleting) onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{tag ? "Edit tag" : "Create tag"}</DialogTitle>
          <DialogDescription>
            {tag
              ? "Changes update this tag everywhere it is used."
              : "Create a reusable tag for this organization."}
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="workspace-people-tag-name">Name</FieldLabel>
            <Input
              id="workspace-people-tag-name"
              value={label}
              maxLength={32}
              autoFocus
              onChange={(event) => setLabel(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return
                event.preventDefault()
                void handleSave()
              }}
            />
          </Field>

          <FieldSet>
            <FieldLegend>Color</FieldLegend>
            <RadioGroup
              value={color}
              onValueChange={(value) =>
                setColor(value as OrganizationPeopleTagColor)
              }
              className="flex flex-wrap gap-1.5"
            >
              {ORGANIZATION_PEOPLE_TAG_COLOR_OPTIONS.map((option) => (
                <RadioGroupItem
                  key={option.value}
                  value={option.value}
                  aria-label={option.label}
                  title={option.label}
                  className="data-[state=checked]:ring-ring aspect-auto h-7 w-10 rounded-md border-2 border-transparent shadow-none ring-offset-2 data-[state=checked]:ring-2 [&_[data-slot=radio-group-indicator]_svg]:fill-white [&_[data-slot=radio-group-indicator]_svg]:text-white"
                  style={{ backgroundColor: option.hex }}
                />
              ))}
            </RadioGroup>
          </FieldSet>
        </FieldGroup>

        <DialogFooter className="sm:justify-between">
          {tag && onDelete ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="destructive">
                  Delete tag
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {tag.label}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This removes the tag from every person. This cannot be
                    undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isDeleting}>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    disabled={isDeleting}
                    className="bg-destructive hover:bg-destructive/90 text-white"
                    onClick={(event) => {
                      event.preventDefault()
                      void handleDelete()
                    }}
                  >
                    {isDeleting ? (
                      <LoaderCircleIcon
                        data-icon="inline-start"
                        className="animate-spin"
                        aria-hidden
                      />
                    ) : null}
                    Delete tag
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <span aria-hidden />
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={isSaving || isDeleting}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!normalizedLabel || isSaving || isDeleting}
              onClick={() => void handleSave()}
            >
              {isSaving ? (
                <LoaderCircleIcon
                  data-icon="inline-start"
                  className="animate-spin"
                  aria-hidden
                />
              ) : null}
              {tag ? "Save changes" : "Create tag"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
