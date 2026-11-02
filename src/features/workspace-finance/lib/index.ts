import type {
  WorkspaceFinanceInput,
  WorkspaceFinanceDataState,
  WorkspaceFinanceOpportunityInput,
  WorkspaceFinanceOrganizationProgramInput,
  WorkspaceFinanceProgramInput,
  WorkspaceFinanceRaisingProgram,
  WorkspaceFinanceRecordInput,
  WorkspaceFinanceSource,
  WorkspaceFinanceSourceKind,
  WorkspaceFinanceView,
} from "../types"

const WORKSPACE_FINANCE_VIEWS = new Set<WorkspaceFinanceView>([
  "activity",
  "history",
])

const SOURCE_LABELS: Record<WorkspaceFinanceSourceKind, string> = {
  donations: "Donations",
  grants: "Grants",
  earned_revenue: "Earned revenue",
  other: "Other",
}

export function buildWorkspaceFinanceProgramInputs(
  programs: WorkspaceFinanceOrganizationProgramInput[]
): WorkspaceFinanceProgramInput[] {
  return programs.map((program) => {
    const rawBudget = program.wizard_snapshot?.budgetUsd
    const budgetUsd =
      typeof rawBudget === "number"
        ? rawBudget
        : typeof rawBudget === "string"
          ? Number(rawBudget)
          : 0

    return {
      id: program.id,
      title: program.title,
      goalCents: program.goal_cents,
      raisedCents: program.raised_cents,
      budgetCents:
        Number.isFinite(budgetUsd) && budgetUsd > 0
          ? Math.round(budgetUsd * 100)
          : null,
    }
  })
}

export function normalizeWorkspaceFinanceInput(input: WorkspaceFinanceInput): {
  initialView: WorkspaceFinanceView
  raisingPrograms: WorkspaceFinanceRaisingProgram[]
  targetCents: number | null
  sources: WorkspaceFinanceSource[]
  sourceTotalCents: number | null
  raisedCents: number
  opportunities: WorkspaceFinanceOpportunityInput[]
  opportunitiesState: WorkspaceFinanceDataState
  records: WorkspaceFinanceRecordInput[]
  recordsState: WorkspaceFinanceDataState
} {
  const initialView = input.initialView ?? "activity"
  const programTitles = new Map(
    (input.programs ?? []).map((program) => [
      program.id,
      program.title?.trim() || "Untitled program",
    ])
  )
  const records = normalizeRecords(input.records ?? [], programTitles)
  const reconciledRaisedByProgram = summarizeReconciledRaisedByProgram(records)
  const raisingPrograms = (input.programs ?? [])
    .map((program) =>
      normalizeRaisingProgram(
        program,
        reconciledRaisedByProgram.get(program.id) ?? 0
      )
    )
    .filter((program): program is WorkspaceFinanceRaisingProgram =>
      Boolean(program)
    )
    .sort((left, right) => {
      const statusOrder = { raising: 0, complete: 1 }
      return (
        statusOrder[left.status] - statusOrder[right.status] ||
        left.title.localeCompare(right.title)
      )
    })
  const targetCents = raisingPrograms.reduce(
    (total, program) => total + program.targetCents,
    0
  )
  const sources = normalizeSources(records)
  const recordedRaisedCents = sources.reduce(
    (total, source) => total + source.amountCents,
    0
  )
  const raisedCents = recordedRaisedCents

  return {
    initialView: WORKSPACE_FINANCE_VIEWS.has(initialView)
      ? initialView
      : "activity",
    raisingPrograms,
    targetCents: targetCents || null,
    sources,
    sourceTotalCents: sources.length ? recordedRaisedCents : null,
    raisedCents,
    opportunities: normalizeOpportunities(input.opportunities ?? []),
    opportunitiesState:
      input.opportunitiesState ??
      (input.opportunities === undefined ? "idle" : "ready"),
    records,
    recordsState:
      input.recordsState ?? (input.records === undefined ? "idle" : "ready"),
  }
}

function normalizeSources(
  records: WorkspaceFinanceRecordInput[]
): WorkspaceFinanceSource[] {
  const totals = new Map<WorkspaceFinanceSourceKind, number>()
  for (const record of records) {
    if (!isReconciledUsdInbound(record) || !record.sourceKind) continue
    const amountCents = normalizeCents(record.amountCents)
    if (!amountCents) continue
    totals.set(
      record.sourceKind,
      (totals.get(record.sourceKind) ?? 0) + amountCents
    )
  }

  const totalCents = [...totals.values()].reduce(
    (total, amountCents) => total + amountCents,
    0
  )

  return (Object.keys(SOURCE_LABELS) as WorkspaceFinanceSourceKind[])
    .filter((kind) => totals.has(kind))
    .map((kind) => ({
      kind,
      label: SOURCE_LABELS[kind],
      amountCents: totals.get(kind) ?? 0,
      percentage: totalCents ? ((totals.get(kind) ?? 0) / totalCents) * 100 : 0,
    }))
}

function summarizeReconciledRaisedByProgram(
  records: WorkspaceFinanceRecordInput[]
) {
  const totals = new Map<string, number>()
  for (const record of records) {
    if (!record.programId || !isReconciledUsdInbound(record)) continue
    const amountCents = normalizeCents(record.amountCents)
    if (!amountCents) continue
    totals.set(
      record.programId,
      (totals.get(record.programId) ?? 0) + amountCents
    )
  }
  return totals
}

function isReconciledUsdInbound(record: WorkspaceFinanceRecordInput) {
  const currencyCode = record.currencyCode?.trim().toUpperCase() || "USD"
  return (
    record.direction === "in" &&
    record.status === "reconciled" &&
    record.correction?.state !== "corrected" &&
    currencyCode === "USD"
  )
}

function normalizeOpportunities(
  opportunities: NonNullable<WorkspaceFinanceInput["opportunities"]>
) {
  const statusOrder: Record<
    WorkspaceFinanceOpportunityInput["status"],
    number
  > = {
    new: 0,
    saved: 1,
    applied: 2,
    awarded: 3,
    not_awarded: 4,
    dismissed: 5,
  }
  return opportunities
    .filter((opportunity) => opportunity.status !== "dismissed" && opportunity.id && opportunity.title.trim())
    .map((opportunity) => ({
      ...opportunity,
      title: opportunity.title.trim(),
      source: opportunity.source?.trim() || null,
    }))
    .sort(
      (left, right) =>
        (left.feedPosition ?? Number.MAX_SAFE_INTEGER) - (right.feedPosition ?? Number.MAX_SAFE_INTEGER) ||
        statusOrder[left.status] - statusOrder[right.status] ||
        (left.dueAt ?? "9999").localeCompare(right.dueAt ?? "9999")
    )
}

function normalizeRecords(
  records: NonNullable<WorkspaceFinanceInput["records"]>,
  programTitles: Map<string, string>
) {
  return records
    .filter(
      (record) =>
        record.id &&
        record.effectiveAt &&
        record.sourceLabel.trim() &&
        record.typeLabel.trim() &&
        (record.amountCents == null || Number.isFinite(record.amountCents))
    )
    .map((record) => ({
      ...record,
      amountCents:
        record.amountCents == null
          ? null
          : Math.max(Math.round(record.amountCents), 0),
      sourceLabel: record.sourceLabel.trim(),
      typeLabel: record.typeLabel.trim(),
      programTitle: record.programId
        ? (programTitles.get(record.programId) ?? null)
        : null,
    }))
    .sort((left, right) => right.effectiveAt.localeCompare(left.effectiveAt))
}

function normalizeRaisingProgram(
  program: NonNullable<WorkspaceFinanceInput["programs"]>[number],
  recordedRaisedCents: number
): WorkspaceFinanceRaisingProgram | null {
  const goalCents = normalizeCents(program.goalCents)
  const raisedCents = normalizeCents(recordedRaisedCents)
  const budgetCents = normalizeCents(program.budgetCents) || null

  if (!goalCents && !budgetCents) return null

  const targetCents = goalCents || budgetCents || 0
  const targetSource = goalCents ? "goal" : "budget"
  const status = raisedCents >= targetCents ? "complete" : "raising"

  return {
    id: program.id,
    title: program.title?.trim() || "Untitled program",
    goalCents,
    raisedCents,
    budgetCents,
    targetCents,
    targetSource,
    remainingCents: Math.max(targetCents - raisedCents, 0),
    progressPercent: targetCents
      ? Math.min((raisedCents / targetCents) * 100, 100)
      : 0,
    status,
  }
}

function normalizeCents(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : 0
}
