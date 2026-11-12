import type { ProfileDocumentLibrary } from "./use-profile-document-library"
import type { DocumentsTabProps } from "../types"
import { useDocumentsIndex } from "./use-documents-index"
import { useDocumentsBannerState } from "./use-documents-banner-state"
import { useDocumentsTabActions } from "./use-documents-tab-actions"
import { usePolicyDraftState } from "./use-policy-draft-state"
import { useDocumentsTabState } from "./use-documents-tab-state"

type UseDocumentsTabControllerArgs = Pick<
  DocumentsTabProps,
  | "userId"
  | "policyProgramOptions"
  | "policyPeopleOptions"
  | "roadmapSections"
> & { library: ProfileDocumentLibrary }

export function useDocumentsTabController({
  userId,
  library,
  policyProgramOptions,
  policyPeopleOptions,
  roadmapSections,
}: UseDocumentsTabControllerArgs) {
  const { documentsState, setDocumentsState, policiesState, setPoliciesState } =
    useDocumentsTabState({ library })

  const {
    clearPendingPolicyDocument,
    createPolicyCategory,
    handlePolicyDialogOpenChange,
    markPolicyDocumentForRemoval,
    openEditPolicyDialog,
    openNewPolicyDialog,
    policyDialogOpen,
    policyDocumentBusy,
    policyDocumentPending,
    policyDocumentRemoveRequested,
    policyDraft,
    removePolicyCategory,
    resetPolicyDocumentMutations,
    selectPolicyDocument,
    setPolicyDialogOpen,
    setPolicyDocumentBusy,
    setPolicyDraft,
    togglePolicyCategory,
  } = usePolicyDraftState()

  const { isBannerVisible } = useDocumentsBannerState({ userId })

  const {
    activeFilters,
    categoryOptions,
    clearFilters,
    filteredRows,
    handleSortColumnChange,
    handleSortDirectionChange,
    hasRoadmapDocuments,
    needsAttentionEnabled,
    searchQuery,
    setSearchQuery,
    sortColumn,
    sortDirection,
    toggleFilter,
    toggleSortColumn,
    updated30dEnabled,
  } = useDocumentsIndex({
    documentsState,
    policiesState,
    policyProgramOptions,
    policyPeopleOptions,
    roadmapSections,
  })
  const {
    deletingKind,
    deletingPolicyId,
    downloadingKind,
    downloadingPolicyDocumentId,
    downloadPolicyDocument,
    handleDelete,
    handleDownload,
    handleDeletePolicy,
    handleSavePolicy,
    handleUpload,
    handleView,
    policySavePending,
    removePolicyDocumentFile,
    uploadingKind,
    viewingKind,
    viewingPolicyDocumentId,
    viewPolicyDocument,
    viewPolicyDraftDocument,
  } = useDocumentsTabActions({
    documentsState,
    setDocumentsState,
    setPoliciesState,
    policyDraft,
    policyDocumentPending,
    policyDocumentRemoveRequested,
    setPolicyDialogOpen,
    setPolicyDocumentBusy,
    resetPolicyDocumentMutations,
  })

  const refreshAfter = <Args extends unknown[]>(action: (...args: Args) => Promise<void>) => async (...args: Args) => {
    try { await action(...args) } finally { library.refresh() }
  }

  return {
    activeFilters,
    categoryOptions,
    clearFilters,
    createPolicyCategory,
    deletingKind,
    deletingPolicyId,
    documentsState,
    policiesState,
    downloadingKind,
    downloadingPolicyDocumentId,
    downloadPolicyDocument,
    filteredRows,
    handleDelete: refreshAfter(handleDelete),
    handleDownload,
    handleDeletePolicy: refreshAfter(handleDeletePolicy),
    handlePolicyDialogOpenChange,
    handleSavePolicy: refreshAfter(handleSavePolicy),
    handleSortColumnChange,
    handleSortDirectionChange,
    handleUpload: refreshAfter(handleUpload),
    handleView,
    hasRoadmapDocuments,
    isBannerVisible,
    markPolicyDocumentForRemoval,
    needsAttentionEnabled,
    openEditPolicyDialog,
    openNewPolicyDialog,
    policyDialogOpen,
    policyDocumentBusy,
    policyDocumentPending,
    policyDraft,
    policySavePending,
    removePolicyCategory,
    removePolicyDocumentFile: refreshAfter(removePolicyDocumentFile),
    searchQuery,
    selectPolicyDocument,
    setPolicyDraft,
    setSearchQuery,
    sortColumn,
    sortDirection,
    toggleFilter,
    togglePolicyCategory,
    toggleSortColumn,
    updated30dEnabled,
    viewingKind,
    viewingPolicyDocumentId,
    viewPolicyDocument,
    viewPolicyDraftDocument,
    clearPendingPolicyDocument,
    uploadingKind,
  }
}
