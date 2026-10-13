"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import LayoutDashboardIcon from "lucide-react/dist/esm/icons/layout-dashboard"
import PencilIcon from "lucide-react/dist/esm/icons/pencil"
import Trash2Icon from "lucide-react/dist/esm/icons/trash-2"
import UserPlusIcon from "lucide-react/dist/esm/icons/user-plus"
import XIcon from "lucide-react/dist/esm/icons/x"

import { deletePersonAction } from "@/actions/people"
import { CreatePersonDialog } from "@/components/people/create-person-dialog"
import type { OrgPersonWithImage } from "@/components/people/supporters-showcase"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { toast } from "@/lib/toast"

import type { WorkspaceCustomPeopleSegment } from "./workspace-canvas-people-segment-types"

type WorkspacePeopleDrawerSelectionActionsProps = {
  selectedPeople: OrgPersonWithImage[]
  allPeople: OrgPersonWithImage[]
  viewerId: string
  placedPersonIds: ReadonlySet<string>
  customSegment: WorkspaceCustomPeopleSegment | null
  customSegmentMemberIds: ReadonlySet<string> | null
  canEdit: boolean
  onAddPeopleToCanvas: (personIds: string[]) => number
  onAddToSegment: (personIds: string[]) => void
  onRemoveFromSegment: (personIds: string[]) => void
  onClearSelection: () => void
}

export function WorkspacePeopleDrawerSelectionActions({
  selectedPeople,
  allPeople,
  viewerId,
  placedPersonIds,
  customSegment,
  customSegmentMemberIds,
  canEdit,
  onAddPeopleToCanvas,
  onAddToSegment,
  onRemoveFromSegment,
  onClearSelection,
}: WorkspacePeopleDrawerSelectionActionsProps) {
  const router = useRouter()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editingPerson, setEditingPerson] = useState<OrgPersonWithImage | null>(
    null
  )
  const [pending, startTransition] = useTransition()
  const selectedCount = selectedPeople.length
  const selectedIds = useMemo(
    () => selectedPeople.map((person) => person.id),
    [selectedPeople]
  )
  const selectedUnplacedIds = useMemo(
    () => selectedIds.filter((personId) => !placedPersonIds.has(personId)),
    [placedPersonIds, selectedIds]
  )
  const deletableSelectedPeople = useMemo(
    () => selectedPeople.filter((person) => person.id !== viewerId),
    [selectedPeople, viewerId]
  )
  const selectedOwnRecord = selectedIds.includes(viewerId)
  const selectedSegmentMemberIds = useMemo(
    () =>
      customSegment
        ? selectedIds.filter((personId) =>
            customSegmentMemberIds?.has(personId)
          )
        : [],
    [customSegment, customSegmentMemberIds, selectedIds]
  )
  const selectedAvailableSegmentIds = useMemo(
    () =>
      customSegment
        ? selectedIds.filter(
            (personId) => !customSegmentMemberIds?.has(personId)
          )
        : [],
    [customSegment, customSegmentMemberIds, selectedIds]
  )
  const singleSelectedPerson =
    selectedCount === 1 ? (selectedPeople[0] ?? null) : null
  const canvasActionLabel =
    selectedUnplacedIds.length === 0 ? "Show on canvas" : "Add to canvas"
  const deleteTitle =
    deletableSelectedPeople.length === 1
      ? `Delete ${deletableSelectedPeople[0]?.name ?? "person"}?`
      : `Delete ${deletableSelectedPeople.length} people?`

  if (selectedCount === 0) return null

  function handleAddToCanvas() {
    const placedCount = onAddPeopleToCanvas(selectedIds)
    if (placedCount > 0) {
      let successMessage = "Added to canvas"
      if (selectedUnplacedIds.length === 0) {
        successMessage =
          selectedCount === 1
            ? "Showing person on canvas"
            : "Showing selected people on canvas"
      } else if (placedCount > 1) {
        successMessage = `Added ${placedCount} people to canvas`
      }

      toast.success(successMessage)
      onClearSelection()
      return
    }

    toast.error("Unable to show selected people on canvas.")
  }

  function handleDeleteSelected() {
    startTransition(async () => {
      const toastId = toast.loading(
        deletableSelectedPeople.length === 1
          ? "Deleting person…"
          : "Deleting people…"
      )
      let deletedCount = 0
      const errors: string[] = []

      for (const person of deletableSelectedPeople) {
        const result = await deletePersonAction(person.id)
        if ("error" in result) {
          errors.push(result.error ?? "Unable to delete selected person.")
        } else {
          deletedCount += 1
        }
      }

      if (deletedCount > 0) {
        toast.success(
          deletedCount === 1
            ? "Deleted person"
            : `Deleted ${deletedCount} people`,
          { id: toastId }
        )
        router.refresh()
        onClearSelection()
      } else {
        toast.error(errors[0] ?? "Unable to delete selected people.", {
          id: toastId,
        })
      }

      setDeleteOpen(false)
    })
  }

  return (
    <>
      <div className="flex w-full min-w-0 flex-wrap items-center justify-start gap-1.5 sm:ml-auto sm:w-auto sm:justify-end">
        {canEdit && singleSelectedPerson ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 rounded-xl px-2.5"
            onClick={() => setEditingPerson(singleSelectedPerson)}
          >
            <PencilIcon aria-hidden />
            Edit
          </Button>
        ) : null}
        {selectedIds.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 rounded-xl px-2.5"
            onClick={handleAddToCanvas}
          >
            <LayoutDashboardIcon aria-hidden />
            {canvasActionLabel}
          </Button>
        ) : null}
        {customSegment && selectedAvailableSegmentIds.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 rounded-xl px-2.5"
            onClick={() => {
              onAddToSegment(selectedAvailableSegmentIds)
              onClearSelection()
            }}
          >
            <UserPlusIcon aria-hidden />
            Add to segment
          </Button>
        ) : null}
        {customSegment && selectedSegmentMemberIds.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 rounded-xl px-2.5"
            onClick={() => {
              onRemoveFromSegment(selectedSegmentMemberIds)
              onClearSelection()
            }}
          >
            <XIcon aria-hidden />
            Remove
          </Button>
        ) : null}
        {canEdit && deletableSelectedPeople.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive h-8 rounded-xl px-2.5"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2Icon aria-hidden />
            Delete
          </Button>
        ) : null}
      </div>

      {editingPerson && canEdit ? (
        <CreatePersonDialog
          initial={editingPerson}
          open={true}
          extendedSocialLinksEnabled
          onOpenChange={(isOpen) => {
            if (!isOpen) setEditingPerson(null)
          }}
          onSaved={() => {
            setEditingPerson(null)
            router.refresh()
          }}
          people={allPeople}
          triggerClassName="hidden"
        />
      ) : null}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              This removes selected people from your org chart and lists. This
              action cannot be undone.
              {selectedOwnRecord
                ? " Your own record is protected and will stay in People."
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={pending}
              onClick={(event) => {
                event.preventDefault()
                handleDeleteSelected()
              }}
            >
              {pending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
