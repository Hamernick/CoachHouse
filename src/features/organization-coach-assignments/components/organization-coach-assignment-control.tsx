"use client"

import {
  Check,
  CircleNotch,
  User,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { getOrganizationCoachInitials } from "../lib"
import type {
  OrganizationCoachAssignment,
  OrganizationCoachOption,
  UpdateOrganizationCoachAssignmentInput,
  UpdateOrganizationCoachAssignmentResult,
} from "../types"
import { useOrganizationCoachAssignmentController } from "../hooks/use-organization-coach-assignments-controller"

type AssignmentAction = (
  input: UpdateOrganizationCoachAssignmentInput
) => Promise<UpdateOrganizationCoachAssignmentResult>

function CoachAvatar({ coach }: { coach: OrganizationCoachOption }) {
  return (
    <Avatar className="border-background size-6 border">
      {coach.avatarUrl ? <AvatarImage src={coach.avatarUrl} alt="" /> : null}
      <AvatarFallback className="text-[10px]">
        {getOrganizationCoachInitials(coach)}
      </AvatarFallback>
    </Avatar>
  )
}

function CoachAvatarStack({
  assignments,
}: {
  assignments: OrganizationCoachAssignment[]
}) {
  if (assignments.length === 0) {
    return (
      <span className="bg-muted flex size-6 items-center justify-center rounded-full">
        <User className="size-3.5" aria-hidden />
      </span>
    )
  }

  return (
    <span className="flex shrink-0 -space-x-2" aria-hidden>
      {assignments.slice(0, 3).map((assignment) => (
        <CoachAvatar key={assignment.coach.id} coach={assignment.coach} />
      ))}
      {assignments.length > 3 ? (
        <span className="bg-muted border-background flex size-6 items-center justify-center rounded-full border text-[9px] font-medium">
          +{assignments.length - 3}
        </span>
      ) : null}
    </span>
  )
}

function getAssignmentSummary(count: number) {
  if (count === 0) return "No coaches"
  if (count === 1) return "1 coach"
  return `${count} coaches`
}

export function OrganizationCoachAssignmentControl({
  assignments,
  canManage,
  coachOptions,
  organizationId,
  organizationName,
  updateAssignmentAction,
  preventEmpty = false,
  compact = false,
}: {
  assignments: OrganizationCoachAssignment[]
  canManage: boolean
  coachOptions: OrganizationCoachOption[]
  organizationId: string
  organizationName: string
  updateAssignmentAction?: AssignmentAction
  preventEmpty?: boolean
  compact?: boolean
}) {
  const controller = useOrganizationCoachAssignmentController({
    assignments,
    organizationId,
    preventEmpty,
    updateAssignmentAction,
  })
  const summary = getAssignmentSummary(controller.assignments.length)
  const accessibleSummary = controller.assignments.length
    ? controller.assignments.map(({ coach }) => coach.name).join(", ")
    : "No coaches assigned"

  if (!canManage || !updateAssignmentAction) {
    return (
      <div
        className={cn(
          "text-muted-foreground flex min-h-9 min-w-0 items-center gap-2 text-xs",
          compact && "max-w-32"
        )}
        aria-label={`${organizationName} coaches: ${accessibleSummary}`}
      >
        <CoachAvatarStack assignments={controller.assignments} />
        {!compact ? <span className="truncate">{summary}</span> : null}
      </div>
    )
  }

  return (
    <Popover open={controller.open} onOpenChange={controller.setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            "h-11 min-w-0 justify-start gap-2 rounded-lg px-2 md:h-9",
            compact ? "max-w-36" : "max-w-52"
          )}
          disabled={controller.pending}
          aria-busy={controller.pending}
          aria-label={`Manage coaches for ${organizationName}; ${accessibleSummary}`}
        >
          <CoachAvatarStack assignments={controller.assignments} />
          {!compact ? <span className="truncate">{summary}</span> : null}
          {controller.pending ? (
            <CircleNotch className="text-muted-foreground ml-auto animate-spin" />
          ) : (
            <UsersThree className="text-muted-foreground ml-auto" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-2">
        <div className="px-2 py-1">
          <p className="text-foreground text-xs font-medium">
            Assigned coaches
          </p>
          <p className="text-muted-foreground text-xs">
            Select everyone who should cover this organization.
          </p>
        </div>
        {preventEmpty ? (
          <p className="text-muted-foreground px-2 py-2 text-xs">
            Assigned-only access is active. Keep at least one coach assigned.
          </p>
        ) : null}
        <div className="mt-1 space-y-1">
          {coachOptions.filter((coach) => coach.assignable !== false).map((coach) => {
            const selected = controller.assignedCoachIds.has(coach.id)
            const removingLast =
              selected && preventEmpty && controller.assignments.length === 1
            return (
              <Button
                key={coach.id}
                type="button"
                variant="ghost"
                className={cn(
                  "h-auto min-h-11 w-full justify-start gap-2 rounded-md px-2 py-2 text-left",
                  selected && "bg-accent"
                )}
                disabled={controller.pending || removingLast}
                aria-pressed={selected}
                onClick={() => controller.toggle(coach)}
              >
                <CoachAvatar coach={coach} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{coach.name}</span>
                  {coach.email ? (
                    <span className="text-muted-foreground block truncate text-xs">
                      {coach.email}
                    </span>
                  ) : null}
                </span>
                {selected ? <Check className="ml-auto" aria-hidden /> : null}
              </Button>
            )
          })}
        </div>
        {coachOptions.length === 0 ? (
          <p className="text-muted-foreground px-2 py-3 text-sm">
            No coach-level staff are available.
          </p>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
