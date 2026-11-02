"use client"

import { useTransition } from "react"
import { toast } from "sonner"

import { updateWorkspaceFinanceOpportunityStatus } from "@/actions/workspace-finance"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import type {
  WorkspaceFinanceOpportunityStatus,
  WorkspaceFinanceOpportunityWorkflowStatus,
} from "../types"

const statusLabels: Record<WorkspaceFinanceOpportunityWorkflowStatus, string> = {
  dismissed: "Archived",
  new: "New",
  saved: "Saved",
  applied: "Applied",
  awarded: "Awarded",
  not_awarded: "Not awarded",
}

const activeStatuses = new Set<WorkspaceFinanceOpportunityStatus>([
  "new",
  "saved",
  "applied",
  "awarded",
  "not_awarded",
])

export function WorkspaceFinanceOpportunityStatusMenu({
  opportunityId,
  opportunityTitle,
  status,
  onStatusChange,
}: {
  opportunityId: string
  opportunityTitle: string
  status: WorkspaceFinanceOpportunityWorkflowStatus
  onStatusChange: (status: WorkspaceFinanceOpportunityWorkflowStatus) => void
}) {
  const [pending, startTransition] = useTransition()
  const sample = opportunityId.startsWith("sample-")

  async function undoDismiss() {
    if (sample) {
      onStatusChange("new")
      return
    }

    const result = await updateWorkspaceFinanceOpportunityStatus({
      opportunityId,
      status: "new",
    })
    if ("error" in result) {
      toast.error(result.error)
      return
    }
    onStatusChange("new")
  }

  function updateStatus(nextStatus: WorkspaceFinanceOpportunityWorkflowStatus) {
    if (nextStatus === status) return
    const previousStatus = status
    onStatusChange(nextStatus)

    startTransition(async () => {
      const result = sample
        ? ({ ok: true } as const)
        : await updateWorkspaceFinanceOpportunityStatus({
            opportunityId,
            status: nextStatus,
          })

      if ("error" in result) {
        onStatusChange(previousStatus)
        toast.error(result.error)
        return
      }

      if (nextStatus === "dismissed") {
        toast.success("Opportunity dismissed", {
          action: {
            label: "Undo",
            onClick: () => void undoDismiss(),
          },
        })
      }
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 rounded-full px-2 text-xs font-normal"
          aria-label={`Change status for ${opportunityTitle}`}
          disabled={pending}
        >
          {statusLabels[status]}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuRadioGroup
          value={status}
          onValueChange={(value) => {
            if (
              activeStatuses.has(value as WorkspaceFinanceOpportunityStatus)
            ) {
              updateStatus(value as WorkspaceFinanceOpportunityStatus)
            }
          }}
        >
          <DropdownMenuRadioItem value="new">New</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="saved">Saved</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="applied">Applied</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="awarded">Awarded</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="not_awarded">
            Not awarded
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => updateStatus("dismissed")}
          >
            Dismiss
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
