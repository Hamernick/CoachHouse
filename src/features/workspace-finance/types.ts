export type WorkspaceFinanceView = "activity" | "history"
export type WorkspaceFinanceDataState = "idle" | "loading" | "ready" | "error"

export type WorkspaceFinanceAccessLevel = "viewer" | "manager"

export type WorkspaceFinanceAccessMember = {
  accessLevel: WorkspaceFinanceAccessLevel | null
  email: string
  memberId: string
}

export type WorkspaceFinanceAccessInput = {
  canManage: boolean
  members: WorkspaceFinanceAccessMember[]
  state: "ready" | "error"
}

export type WorkspaceFinanceProgramInput = {
  id: string
  title?: string | null
  goalCents?: number | null
  raisedCents?: number | null
  budgetCents?: number | null
}

export type WorkspaceFinanceOrganizationProgramInput = {
  id: string
  title?: string | null
  goal_cents?: number | null
  raised_cents?: number | null
  wizard_snapshot?: { budgetUsd?: unknown } | null
}

export type WorkspaceFinanceRaisingProgram = {
  id: string
  title: string
  goalCents: number
  raisedCents: number
  budgetCents: number | null
  targetCents: number
  targetSource: "goal" | "budget"
  remainingCents: number
  progressPercent: number
  status: "raising" | "complete"
}

export type WorkspaceFinanceSourceKind =
  | "donations"
  | "grants"
  | "earned_revenue"
  | "other"

export type WorkspaceFinanceSource = {
  kind: WorkspaceFinanceSourceKind
  amountCents: number
  label: string
  percentage: number
}

export type WorkspaceFinanceOpportunityStatus =
  | "new"
  | "saved"
  | "applied"
  | "awarded"
  | "not_awarded"

export type WorkspaceFinanceOpportunityWorkflowStatus =
  | WorkspaceFinanceOpportunityStatus
  | "dismissed"

export type WorkspaceFinanceOpportunityInput = {
  id: string
  title: string
  source?: string | null
  sources?: import("./lib/opportunity-sources").OpportunitySource[]
  dueAt?: string | null
  discoveredAt?: string | null
  status: WorkspaceFinanceOpportunityStatus
  attribution?: "grants_gov"
}

export type WorkspaceFinanceRecordStatus = "draft" | "recorded" | "reconciled"

export type WorkspaceFinanceReconciliationInput = {
  evidenceId: string
  externalReference: string
  fileName: string
  reconciledAt: string
}

export type WorkspaceFinanceCorrectionInput = {
  correctionId: string
  correctedAt: string
  reason: string
  relatedRecordId: string
  state: "corrected" | "replacement"
}

export type WorkspaceFinanceRecordInput = {
  id: string
  programId?: string | null
  programTitle?: string | null
  effectiveAt: string
  sourceLabel: string
  recordType?: string | null
  typeLabel: string
  amountCents?: number | null
  currencyCode?: string | null
  direction?: "in" | "out" | null
  status?: WorkspaceFinanceRecordStatus | null
  sourceKind?: WorkspaceFinanceSourceKind | null
  reconciliation?: WorkspaceFinanceReconciliationInput | null
  correction?: WorkspaceFinanceCorrectionInput | null
}

export type WorkspaceFinanceRecordCorrectionResult = {
  originalRecordId: string
  originalCorrection: WorkspaceFinanceCorrectionInput
  replacementRecord: WorkspaceFinanceRecordInput
}

export type WorkspaceFinanceStripeConnectionInput = {
  state: "not_configured" | "not_connected" | "connected" | "error"
  accountId?: string | null
  livemode?: boolean | null
  defaultRecordType?:
    | "donation"
    | "grant"
    | "earned_revenue"
    | "other_income"
    | null
  connectedAt?: string | null
  lastSyncedAt?: string | null
  lastSyncStatus?: "idle" | "running" | "succeeded" | "failed" | null
  lastSyncError?: string | null
}

export type WorkspaceFinanceInput = {
  access?: WorkspaceFinanceAccessInput
  initialView?: WorkspaceFinanceView | null
  programs?: WorkspaceFinanceProgramInput[]
  opportunities?: WorkspaceFinanceOpportunityInput[]
  opportunitiesState?: WorkspaceFinanceDataState
  records?: WorkspaceFinanceRecordInput[]
  recordsState?: WorkspaceFinanceDataState
  stripeConnection?: WorkspaceFinanceStripeConnectionInput
}
