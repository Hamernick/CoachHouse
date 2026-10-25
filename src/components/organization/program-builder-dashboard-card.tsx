"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import ClipboardListIcon from "lucide-react/dist/esm/icons/clipboard-list"
import FolderPlusIcon from "lucide-react/dist/esm/icons/folder-plus"

import { ProgramWizardLazy } from "@/components/programs/program-wizard-lazy"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Empty } from "@/components/ui/empty"
import type { OrgProgram } from "@/components/organization/org-profile-card/types"
import {
  dateRangeChip,
  locationSummary,
} from "@/components/organization/org-profile-card/utils"
import {
  ORGANIZATION_ACTIVITY_KIND_DEFINITIONS,
  ORGANIZATION_ACTIVITY_KIND_SUMMARY,
  isOrganizationPrimaryObjectKind,
  resolveOrganizationPrimaryObjectKind,
} from "@/lib/organization/primary-objects"
import { cn } from "@/lib/utils"
import { getWorkspaceEditorPath } from "@/lib/workspace/routes"

type ProgramBuilderDashboardCardProps = {
  programs: OrgProgram[]
  className?: string
}

const PROGRAM_CARD_FRAME_CLASS =
  "flex h-full min-w-0 flex-col overflow-hidden min-h-[460px] md:min-h-[500px] xl:min-h-[540px] max-h-[760px]"
const PROGRAM_CARD_CONTENT_CLASS = "flex min-h-0 min-w-0 flex-1 overflow-hidden"
const PROGRAM_CARD_PANEL_CLASS =
  "min-h-0 min-w-0 overflow-y-auto rounded-xl border border-border/60 bg-background/20"

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function formatMoney(cents: number | null | undefined) {
  const dollars =
    typeof cents === "number" && Number.isFinite(cents) ? cents / 100 : 0
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Math.max(0, dollars))
}

function parseProgramType(program: OrgProgram) {
  if (!isRecord(program.wizard_snapshot)) return null
  const value = program.wizard_snapshot.programType
  return typeof value === "string" && value.trim().length > 0 ? value : null
}

function parseObjectKind(program: OrgProgram) {
  if (isRecord(program.wizard_snapshot)) {
    const value = program.wizard_snapshot.objectKind
    if (isOrganizationPrimaryObjectKind(value)) return value
  }
  const featureKind = Array.isArray(program.features)
    ? program.features.find(isOrganizationPrimaryObjectKind)
    : null
  return resolveOrganizationPrimaryObjectKind(featureKind)
}

function parseCoreFormat(program: OrgProgram) {
  if (!isRecord(program.wizard_snapshot)) return null
  const value = program.wizard_snapshot.coreFormat
  return typeof value === "string" && value.trim().length > 0 ? value : null
}

function parseOutcomes(program: OrgProgram) {
  if (!isRecord(program.wizard_snapshot)) return []
  const raw = program.wizard_snapshot.successOutcomes
  if (!Array.isArray(raw)) return []
  return raw
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean)
    .slice(0, 3)
}

function parseProgramChips(program: OrgProgram): string[] {
  const chips = [
    parseObjectKind(program),
    dateRangeChip(program.start_date, program.end_date) ||
      program.duration_label ||
      null,
    parseCoreFormat(program),
    parseProgramType(program),
  ]
  return chips.filter((value): value is string =>
    Boolean(value && value.trim())
  )
}

function parseBudgetTotalCents(program: OrgProgram) {
  if (!isRecord(program.wizard_snapshot)) return program.goal_cents ?? 0
  const value = program.wizard_snapshot.budgetUsd
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.round(value * 100)
  }
  if (typeof value === "string") {
    const parsed = Number(value)
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.round(parsed * 100)
    }
  }
  return program.goal_cents ?? 0
}

export function ProgramBuilderDashboardCard({
  programs,
  className,
}: ProgramBuilderDashboardCardProps) {
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [selectedProgram, setSelectedProgram] = useState<OrgProgram | null>(
    null
  )
  const [activeProgramId, setActiveProgramId] = useState<string | null>(null)

  const sortedPrograms = useMemo(
    () =>
      [...programs].sort((a, b) => {
        const left = a.created_at ? Date.parse(a.created_at) : 0
        const right = b.created_at ? Date.parse(b.created_at) : 0
        return right - left
      }),
    [programs]
  )

  useEffect(() => {
    if (sortedPrograms.length === 0) {
      setActiveProgramId(null)
      return
    }
    if (
      !activeProgramId ||
      !sortedPrograms.some((program) => program.id === activeProgramId)
    ) {
      setActiveProgramId(sortedPrograms[0].id)
    }
  }, [activeProgramId, sortedPrograms])

  const activeProgram = useMemo(
    () =>
      sortedPrograms.find((program) => program.id === activeProgramId) ??
      sortedPrograms[0] ??
      null,
    [activeProgramId, sortedPrograms]
  )

  const handleCreateOpenChange = (open: boolean) => {
    setCreateOpen(open)
    if (!open) {
      router.refresh()
    }
  }

  const handleEditOpenChange = (open: boolean) => {
    setEditOpen(open)
    if (!open) {
      setSelectedProgram(null)
      router.refresh()
    }
  }

  return (
    <>
      <Card className={cn(className, PROGRAM_CARD_FRAME_CLASS)}>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardListIcon className="h-4 w-4" aria-hidden />
                Resource
              </CardTitle>
              <CardDescription>
                Track {ORGANIZATION_ACTIVITY_KIND_SUMMARY}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                className="h-9"
                onClick={() => {
                  setCreateOpen(true)
                }}
              >
                <FolderPlusIcon className="h-4 w-4" aria-hidden />
                Add resource
              </Button>
            </div>
          </div>
          <div
            className="flex flex-wrap gap-1.5"
            aria-label="Supported activity types"
          >
            {ORGANIZATION_ACTIVITY_KIND_DEFINITIONS.map(
              ({ kind, description }) => (
                <span
                  key={kind}
                  title={description}
                  className="border-border/60 bg-muted/25 text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px]"
                >
                  <span
                    className="bg-muted-foreground/45 h-1.5 w-1.5 rounded-full"
                    aria-hidden
                  />
                  {kind}
                </span>
              )
            )}
          </div>
        </CardHeader>
        <CardContent className={PROGRAM_CARD_CONTENT_CLASS}>
          {sortedPrograms.length === 0 ? (
            <Empty
              className="h-full w-full rounded-xl"
              size="sm"
              title="No resources to display"
              description="Initiatives, projects, programs, events, and services you create will appear here."
              actions={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9"
                  onClick={() => {
                    setCreateOpen(true)
                  }}
                >
                  Start activity builder
                </Button>
              }
            />
          ) : (
            <div className="grid h-full min-h-0 min-w-0 gap-3 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <div className={PROGRAM_CARD_PANEL_CLASS}>
                {sortedPrograms.map((program, index) => {
                  const displayTitle =
                    program.title?.trim() || "Untitled resource"
                  const displayObjectKind = parseObjectKind(program)
                  const displayType = parseProgramType(program)
                  const statusLabel = program.status_label?.trim() || "Draft"
                  const budget = formatMoney(parseBudgetTotalCents(program))
                  const fundraisingTarget = formatMoney(program.goal_cents)
                  const active = activeProgram?.id === program.id
                  return (
                    <Button
                      key={program.id}
                      type="button"
                      variant="ghost"
                      className={cn(
                        "hover:bg-muted/30 h-auto w-full justify-start px-3 py-2.5 text-left whitespace-normal transition",
                        index > 0 && "border-border/60 border-t",
                        active && "bg-muted/40"
                      )}
                      onClick={() => setActiveProgramId(program.id)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {displayTitle}
                          </p>
                          <p className="text-muted-foreground mt-1 text-xs">
                            {displayObjectKind}
                            {displayType ? ` · ${displayType}` : ""} · Budget{" "}
                            {budget} · Need {fundraisingTarget}
                          </p>
                        </div>
                        <Badge
                          variant={active ? "default" : "secondary"}
                          className="shrink-0 rounded-full text-[10px] whitespace-nowrap"
                        >
                          {statusLabel}
                        </Badge>
                      </div>
                    </Button>
                  )
                })}
              </div>

              {activeProgram ? (
                <div className="border-border/60 bg-muted/20 min-h-0 min-w-0 overflow-y-auto rounded-xl border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-foreground truncate text-base font-semibold">
                        {activeProgram.title?.trim() || "Untitled resource"}
                      </p>
                      <p className="text-muted-foreground mt-1 truncate text-sm">
                        {locationSummary(activeProgram) || "Location pending"}
                      </p>
                    </div>
                    <Badge className="shrink-0 rounded-full text-[10px]">
                      {activeProgram.status_label?.trim() || "Draft"}
                    </Badge>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {parseProgramChips(activeProgram).map((chip) => (
                      <span
                        key={chip}
                        className="border-border/60 bg-background/60 text-muted-foreground inline-flex items-center rounded-full border px-2 py-0.5 text-[11px]"
                      >
                        {chip}
                      </span>
                    ))}
                  </div>

                  <dl className="divide-border/50 border-border/60 bg-background/20 mt-4 divide-y rounded-lg border text-sm">
                    <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <dt className="text-muted-foreground text-xs tracking-wide uppercase">
                        Budget
                      </dt>
                      <dd className="font-medium tabular-nums">
                        {formatMoney(parseBudgetTotalCents(activeProgram))}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <dt className="text-muted-foreground text-xs tracking-wide uppercase">
                        Fundraising target
                      </dt>
                      <dd className="font-medium tabular-nums">
                        {formatMoney(activeProgram.goal_cents)}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <dt className="text-muted-foreground text-xs tracking-wide uppercase">
                        Raised
                      </dt>
                      <dd className="font-medium tabular-nums">
                        {formatMoney(activeProgram.raised_cents)}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <dt className="text-muted-foreground text-xs tracking-wide uppercase">
                        Outcomes
                      </dt>
                      <dd className="font-medium tabular-nums">
                        {parseOutcomes(activeProgram).length}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-4">
                    <p className="text-muted-foreground text-xs tracking-wide uppercase">
                      Outcomes snapshot
                    </p>
                    {parseOutcomes(activeProgram).length > 0 ? (
                      <ul className="mt-2 space-y-1 text-sm">
                        {parseOutcomes(activeProgram).map((outcome) => (
                          <li key={outcome}>- {outcome}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-muted-foreground mt-2 text-sm">
                        Add outcomes in the activity builder Step 3.
                      </p>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      className="h-8"
                      onClick={() => {
                        setSelectedProgram(activeProgram)
                        setEditOpen(true)
                      }}
                    >
                      Edit brief
                    </Button>
                    <Button asChild size="sm" variant="outline" className="h-8">
                      <Link
                        href={getWorkspaceEditorPath({
                          tab: "programs",
                          programId: activeProgram.id,
                        })}
                      >
                        Open full view
                      </Link>
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      <ProgramWizardLazy
        mode="create"
        open={createOpen}
        onOpenChange={handleCreateOpenChange}
      />
      {selectedProgram ? (
        <ProgramWizardLazy
          mode="edit"
          program={selectedProgram}
          open={editOpen}
          onOpenChange={handleEditOpenChange}
        />
      ) : null}
    </>
  )
}
