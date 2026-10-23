export {
  WorkspaceFinancePanel,
  WorkspaceFinanceStripeConnection,
} from "./components"
export { WorkspaceOpportunitiesFeed } from "./components/workspace-opportunities-feed"
export { opportunitySourcesSchema, readOpportunitySources, sourceKey } from "./lib/opportunity-sources"
export type { OpportunitySource, OpportunitySourceOption } from "./lib/opportunity-sources"
export {
  buildWorkspaceFinanceProgramInputs,
  normalizeWorkspaceFinanceInput,
} from "./lib"
export {
  normalizeWorkspaceFinanceManualRecord,
  type WorkspaceFinanceManualRecordInput,
} from "./lib/manual-record"
export {
  getWorkspaceFinanceRecordTypeLabel,
  WORKSPACE_FINANCE_MANUAL_RECORD_TYPES,
  type WorkspaceFinanceManualRecordType,
} from "./lib/record-types"
export type {
  WorkspaceFinanceDataState,
  WorkspaceFinanceInput,
  WorkspaceFinanceOpportunityInput,
  WorkspaceFinanceOpportunityStatus,
  WorkspaceFinanceOpportunityWorkflowStatus,
  WorkspaceFinanceOrganizationProgramInput,
  WorkspaceFinanceProgramInput,
  WorkspaceFinanceCorrectionInput,
  WorkspaceFinanceReconciliationInput,
  WorkspaceFinanceRaisingProgram,
  WorkspaceFinanceRecordInput,
  WorkspaceFinanceRecordCorrectionResult,
  WorkspaceFinanceRecordStatus,
  WorkspaceFinanceSource,
  WorkspaceFinanceSourceKind,
  WorkspaceFinanceStripeConnectionInput,
  WorkspaceFinanceView,
} from "./types"
