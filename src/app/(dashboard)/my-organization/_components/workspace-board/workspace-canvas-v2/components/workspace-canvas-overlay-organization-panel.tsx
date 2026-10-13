"use client"

import dynamic from "next/dynamic"
import { useEffect, useState, type ComponentProps } from "react"

import { toast } from "@/lib/toast"
import { Skeleton } from "@/components/ui/skeleton"

import type { WorkspaceOrganizationEditorData } from "../../workspace-board-types"
import { resolveRetainedDrawerRequest } from "./workspace-retained-panel"
import type { WorkspaceDataDrawerRequest } from "./workspace-canvas-overlay-drawer-tabs"

const MyOrganizationEditorView = dynamic<
  ComponentProps<
    typeof import("../../../my-organization-editor-view").MyOrganizationEditorView
  >
>(
  () =>
    import("../../../my-organization-editor-view").then(
      (module) => module.MyOrganizationEditorView
    ),
  {
    loading: () => (
      <div className="flex h-full min-h-0 flex-col gap-3 p-2 sm:p-3">
        <Skeleton className="h-36 w-full shrink-0 rounded-2xl" />
        <Skeleton className="min-h-60 flex-1 rounded-2xl" />
      </div>
    ),
  }
)

export function WorkspaceCanvasOverlayOrganizationPanel({
  data,
  request,
}: {
  data: WorkspaceOrganizationEditorData
  request: WorkspaceDataDrawerRequest | null
}) {
  const [programEditorOpen, setProgramEditorOpen] = useState(false)
  const [appliedRequest, setAppliedRequest] = useState(request)
  // An open program owns its form and initial step. Apply a new destination only
  // after it closes; profile drafts remain in the same editor throughout.
  const destination = resolveRetainedDrawerRequest(
    appliedRequest,
    request,
    !programEditorOpen
  )
  if (destination !== appliedRequest) setAppliedRequest(destination)
  const pendingRequestId =
    programEditorOpen && request?.id !== appliedRequest?.id ? request?.id : null
  useEffect(() => {
    if (pendingRequestId != null)
      toast.info("Close the current program editor to follow this link.")
  }, [pendingRequestId])
  return (
    <div
      data-workspace-organization-drawer-panel="true"
      className="mx-auto box-border w-full max-w-3xl min-w-0 p-2 select-text sm:p-3 [&_[data-slot=organization-profile-section]]:grid-cols-1 [&_div:has(>[data-slot=organization-profile-field])]:grid-cols-1"
    >
      <MyOrganizationEditorView
        navigationRequestId={destination?.id}
        onProgramEditorOpenChange={setProgramEditorOpen}
        embedded
        scrollMode="parent"
        initialProfile={data.initialProfile}
        people={data.people}
        programs={data.programs}
        initialTab={
          destination?.tab === "organization"
            ? (destination.organizationTab ?? "company")
            : undefined
        }
        initialProgramId={
          destination?.tab === "organization"
            ? destination.organizationProgramId
            : null
        }
        initialProgramStep={
          destination?.tab === "organization"
            ? destination.organizationProgramStep
            : null
        }
        initialFocus={
          destination?.tab === "organization"
            ? destination.organizationFocus
            : null
        }
        initialEditMode={
          destination?.tab === "organization" &&
          destination.organizationEditMode
        }
        canEdit={data.canEdit}
      />
    </div>
  )
}
