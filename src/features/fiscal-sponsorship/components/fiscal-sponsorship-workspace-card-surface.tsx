import Image from "next/image"
import type { ReactNode } from "react"
import Link from "next/link"
import CheckCircle2Icon from "lucide-react/dist/esm/icons/check-circle-2"
import CircleDashedIcon from "lucide-react/dist/esm/icons/circle-dashed"
import FileTextIcon from "lucide-react/dist/esm/icons/file-text"
import ImageIcon from "lucide-react/dist/esm/icons/image"
import PanelRightOpenIcon from "lucide-react/dist/esm/icons/panel-right-open"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

import {
  FISCAL_SPONSORSHIP_HANDBOOK_HREF,
  formatFiscalSponsorshipProgramAmount,
} from "../lib/application-data"
import type {
  FiscalSponsorshipProgramOption,
  FiscalSponsorshipProjectWorkbenchPhase,
} from "../types"
import { FiscalSponsorshipMark } from "./fiscal-sponsorship-mark"

export type FiscalSponsorshipWorkspaceWorkflowItem = Pick<
  FiscalSponsorshipProjectWorkbenchPhase,
  "id" | "label" | "description" | "complete"
> &
  Partial<
    Pick<FiscalSponsorshipProjectWorkbenchPhase, "actionLabel" | "actionType">
  >

export const FALLBACK_WORKFLOW_ITEMS: readonly FiscalSponsorshipWorkspaceWorkflowItem[] =
  [
    {
      id: "application-intake",
      label: "Application intake",
      description: "Project, legal, budget, fundraising, and risk details.",
      complete: true,
    },
    {
      id: "required-documents",
      label: "Required documents",
      description: "Tax identity, formation, budget, and fundraising support.",
      complete: false,
    },
    {
      id: "agreement",
      label: "Agreement",
      description:
        "Coach House review, Form B agreement, and native signing packet.",
      complete: false,
    },
    {
      id: "grant-request",
      label: "Submit grant request",
      description: "Amount, payment method, use of funds, and documentation.",
      complete: false,
    },
  ]

const FISCAL_SPONSORSHIP_WORKFLOW_ITEM_ROW_CLASSNAME =
  "group -mx-1 flex min-w-0 items-center gap-2 rounded-xl border border-transparent px-3 py-2.5 transition-[background-color,box-shadow] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
const FISCAL_SPONSORSHIP_WORKFLOW_ITEM_BUTTON_CLASSNAME =
  "text-left outline-none hover:bg-muted/50 focus-visible:ring-ring/50 focus-visible:ring-2"
const FISCAL_SPONSORSHIP_WORKFLOW_ITEM_ACTION_PILL_CLASSNAME =
  "text-muted-foreground ml-auto inline-flex h-6 shrink-0 items-center justify-center rounded-md px-2 text-[10px] font-medium leading-none transition-colors group-hover:bg-accent group-hover:text-foreground group-focus-visible:bg-accent group-focus-visible:text-foreground motion-reduce:transition-none"

function cleanText(value: string | null | undefined) {
  const trimmed = value?.trim() ?? ""
  return trimmed.length > 0 ? trimmed : null
}

function firstText(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const cleaned = cleanText(value)
    if (cleaned) return cleaned
  }

  return null
}

function resolveProgramSourceLabel(program: FiscalSponsorshipProgramOption) {
  return firstText(program.objectKind, program.focusArea, "Activity")
}

function resolveProgramHeroImageUrl(program: FiscalSponsorshipProgramOption) {
  return firstText(program.bannerImageUrl, program.imageUrl)
}

function resolveProgramSummary(programs: FiscalSponsorshipProgramOption[]) {
  const count = programs.length
  const totalGoal = programs.reduce(
    (sum, program) => sum + Math.max(0, program.goalCents ?? 0),
    0
  )
  const formattedGoal = formatFiscalSponsorshipProgramAmount(totalGoal)

  if (count === 0) {
    return {
      label: "No activity selected",
      description: "Create or connect an activity before applying.",
    }
  }

  return {
    label: `${count} ${count === 1 ? "activity" : "activities"} ready`,
    description: formattedGoal
      ? `${formattedGoal} in visible fundraising goals can prefill intake.`
      : "Activity records can prefill sponsorship intake.",
  }
}

function resolveWorkflowItemActionLabel(
  item: FiscalSponsorshipWorkspaceWorkflowItem
) {
  if (item.complete) return "View"

  if (item.actionType === "application") return "Start"
  if (item.actionType === "signature") return "Sign"
  if (item.actionType === "document") return "View"
  if (item.actionType === "assets") {
    const normalizedLabel = item.actionLabel?.toLowerCase() ?? ""

    if (normalizedLabel.includes("upload")) return "Upload"

    return "Edit"
  }
  if (item.actionType === "waiting") {
    if (item.actionLabel === "Locked") return "Locked"
    if (item.actionLabel === "Coach House managed") return "Managed"

    return "Waiting"
  }

  if (item.id === "required-documents") return "Upload"
  if (item.id === "agreement") return "Sign"
  if (item.id === "grant-request") return "Start"

  return "Start"
}

type FiscalSponsorshipWorkspaceCardSurfaceProps = {
  applicationSummary?: { name: string; status: string }
  applicationLinks?: ReactNode
  className?: string
  draggable?: boolean
  onOpenFlow?: (phaseId?: string) => void
  openFlowHref?: string
  onSelectProgram?: (programId: string) => void
  primaryActionLabel?: string
  programs?: FiscalSponsorshipProgramOption[]
  progress?: number
  selectedProgramId?: string | null
  workflowItems?: readonly FiscalSponsorshipWorkspaceWorkflowItem[]
}

export function FiscalSponsorshipWorkspaceCardSurface({
  applicationSummary,
  applicationLinks,
  className,
  draggable = false,
  onOpenFlow,
  openFlowHref,
  onSelectProgram,
  primaryActionLabel = "Start application",
  programs = [],
  progress,
  selectedProgramId = null,
  workflowItems = FALLBACK_WORKFLOW_ITEMS,
}: FiscalSponsorshipWorkspaceCardSurfaceProps) {
  const selectedProgram =
    programs.find((program) => program.id === selectedProgramId) ??
    programs[0] ??
    null
  const completedCount = workflowItems.filter((item) => item.complete).length
  const resolvedProgress = Math.max(
    0,
    Math.min(
      100,
      progress ??
        (workflowItems.length > 0
          ? Math.round((completedCount / workflowItems.length) * 100)
          : 0)
    )
  )
  const programSummary = resolveProgramSummary(programs)

  return (
    <Card
      data-workspace-card="fiscal-sponsorship"
      data-fiscal-sponsorship-surface="workspace-card"
      className={cn(
        "border-border/60 bg-muted relative w-full max-w-[42rem] min-w-0 rounded-[2rem] p-3 shadow-sm",
        className
      )}
    >
      <CardHeader
        className={cn(
          "px-4 pt-2 pb-4",
          draggable &&
            "workspace-card-drag-handle cursor-grab touch-manipulation select-none active:cursor-grabbing"
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <FiscalSponsorshipMark />
          <div className="flex min-w-0 flex-1 flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <CardTitle className="text-lg leading-tight font-semibold tracking-tight sm:text-xl">
              Fiscal Sponsorship
            </CardTitle>
            <Badge
              variant="secondary"
              className="rounded-full px-3 py-1 sm:ml-auto"
            >
              Model C
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <div className="bg-background border-border/60 mx-3 rounded-[1.6rem] border p-3">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">{applicationSummary?.name ?? programSummary.label}</p>
              <p className="text-muted-foreground mt-1 text-xs leading-snug">
                {applicationSummary?.status ?? programSummary.description}
              </p>
            </div>
            {!applicationSummary && <div className="text-right">
              <p className="text-sm font-semibold tabular-nums">
                {resolvedProgress}%
              </p>
              <p className="text-muted-foreground text-[11px]">ready</p>
            </div>}
          </div>
          {!applicationSummary && <Progress value={resolvedProgress} className="mt-3 h-1.5" />}
          {programs.length > 0 ? (
            <div className="mt-3 flex flex-col gap-1.5">
              <p className="text-muted-foreground px-1 text-[11px] font-medium">
                Activity source
              </p>
              {programs.map((program) => {
                const selected = selectedProgram?.id === program.id
                const sourceLabel = resolveProgramSourceLabel(program)
                const formattedGoal = formatFiscalSponsorshipProgramAmount(
                  program.goalCents
                )
                const heroImageUrl = resolveProgramHeroImageUrl(program)
                const content = (
                  <>
                    <span className="flex min-w-0 flex-1 items-center gap-3">
                      <span className="bg-muted ring-border/60 relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl ring-1">
                        {heroImageUrl ? (
                          <Image
                            src={heroImageUrl}
                            alt=""
                            fill
                            sizes="48px"
                            className="object-cover"
                          />
                        ) : (
                          <ImageIcon
                            className="text-muted-foreground size-4"
                            aria-hidden
                          />
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="text-foreground block text-xs leading-snug font-medium break-words">
                          {program.title?.trim() || "Untitled activity"}
                        </span>
                        <span className="text-muted-foreground mt-0.5 block text-[11px] leading-snug break-words">
                          {[sourceLabel, formattedGoal]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                    </span>
                    <Badge
                      variant={selected ? "default" : "outline"}
                      className="h-6 shrink-0 self-start rounded-full px-2 text-[10px] sm:self-auto"
                    >
                      {selected ? "Selected" : "Use"}
                    </Badge>
                  </>
                )
                const rowClassName = cn(
                  "group hover:bg-muted/50 focus-visible:ring-ring/50 flex min-w-0 flex-col items-stretch gap-2 rounded-xl border border-transparent p-2 text-left transition-[background-color,color] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] outline-none focus-visible:ring-2 motion-reduce:transition-none sm:flex-row sm:items-center sm:justify-between sm:gap-3",
                  selected && "bg-muted/60"
                )

                return onSelectProgram ? (
                  <button
                    key={program.id}
                    type="button"
                    aria-pressed={selected}
                    className={rowClassName}
                    onClick={() => onSelectProgram(program.id)}
                  >
                    {content}
                  </button>
                ) : (
                  <div
                    key={program.id}
                    aria-current={selected ? "true" : undefined}
                    className={rowClassName}
                  >
                    {content}
                  </div>
                )
              })}
            </div>
          ) : null}
          <div className="mt-3 flex flex-col gap-1.5">
            {workflowItems.map((item) => {
              const Icon = item.complete ? CheckCircle2Icon : CircleDashedIcon
              const actionLabel = resolveWorkflowItemActionLabel(item)
              const content = (
                <>
                  <Icon
                    className={cn(
                      "size-4 shrink-0",
                      item.complete ? "text-emerald-600" : "text-amber-600"
                    )}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1 text-left">
                    <p className="text-foreground text-xs leading-snug font-medium break-words">
                      {item.label}
                    </p>
                  </div>
                  <span
                    className={
                      FISCAL_SPONSORSHIP_WORKFLOW_ITEM_ACTION_PILL_CLASSNAME
                    }
                  >
                    {actionLabel}
                  </span>
                </>
              )

              return openFlowHref ? (
                <Link
                  key={item.id}
                  href={openFlowHref}
                  className={cn(
                    FISCAL_SPONSORSHIP_WORKFLOW_ITEM_ROW_CLASSNAME,
                    FISCAL_SPONSORSHIP_WORKFLOW_ITEM_BUTTON_CLASSNAME,
                    item.complete && "bg-muted/55"
                  )}
                >
                  {content}
                </Link>
              ) : onOpenFlow ? (
                <button
                  key={item.id}
                  type="button"
                  className={cn(
                    FISCAL_SPONSORSHIP_WORKFLOW_ITEM_ROW_CLASSNAME,
                    FISCAL_SPONSORSHIP_WORKFLOW_ITEM_BUTTON_CLASSNAME,
                    item.complete && "bg-muted/55"
                  )}
                  onClick={() => onOpenFlow(item.id)}
                >
                  {content}
                </button>
              ) : (
                <div
                  key={item.id}
                  className={cn(
                    FISCAL_SPONSORSHIP_WORKFLOW_ITEM_ROW_CLASSNAME,
                    item.complete && "bg-muted/55"
                  )}
                >
                  {content}
                </div>
              )
            })}
          </div>
        </div>
        {applicationLinks}
      </CardContent>
      <CardFooter className="flex-wrap items-center justify-between gap-3 px-4 pt-4 pb-1">
        <Button asChild variant="ghost" size="sm" className="rounded-full">
          <a href={FISCAL_SPONSORSHIP_HANDBOOK_HREF}>
            <FileTextIcon data-icon="inline-start" aria-hidden />
            Handbook
          </a>
        </Button>
        {openFlowHref ? (
          <Button asChild size="sm" className="rounded-full">
            <Link href={openFlowHref}>
              <PanelRightOpenIcon data-icon="inline-start" aria-hidden />
              {primaryActionLabel}
            </Link>
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            className="rounded-full"
            onClick={() => onOpenFlow?.()}
            disabled={!onOpenFlow}
          >
            <PanelRightOpenIcon data-icon="inline-start" aria-hidden />
            {primaryActionLabel}
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}
