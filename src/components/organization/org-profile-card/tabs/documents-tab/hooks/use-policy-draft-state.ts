import { useWorkspaceEditorStatus } from "@/components/workspace/workspace-editor-status"
import { useState } from "react"

import { toast } from "@/lib/toast"

import { normalizeCategories, validatePdf } from "../helpers"
import type { DocumentsPolicyEntry, PolicyDraft } from "../types"
import { createEmptyPolicyDraft, toPolicyDraft } from "./policy-draft-helpers"

export function usePolicyDraftState() {
  const [policyDialogOpen, setPolicyDialogOpen] = useState(false)
  const [policyDraft, setPolicyDraft] = useState<PolicyDraft>(
    createEmptyPolicyDraft()
  )
  const [baseline, setBaseline] = useState<PolicyDraft>(
    createEmptyPolicyDraft()
  )
  const [policyDocumentPending, setPolicyDocumentPending] =
    useState<File | null>(null)
  const [policyDocumentRemoveRequested, setPolicyDocumentRemoveRequested] =
    useState(false)
  const [policyDocumentBusy, setPolicyDocumentBusy] = useState(false)

  useWorkspaceEditorStatus({
    label: "Document policy",
    dirty:
      policyDialogOpen &&
      (JSON.stringify(policyDraft) !== JSON.stringify(baseline) ||
        Boolean(policyDocumentPending) ||
        policyDocumentRemoveRequested),
    pending: policyDialogOpen && policyDocumentBusy,
  })
  const resetPolicyDocumentMutations = () => {
    setPolicyDocumentPending(null)
    setPolicyDocumentRemoveRequested(false)
    setPolicyDocumentBusy(false)
  }

  const togglePolicyCategory = (category: string) => {
    setPolicyDraft((current) => {
      const selected = new Set(current.categories)
      if (selected.has(category)) selected.delete(category)
      else selected.add(category)
      return {
        ...current,
        categories: normalizeCategories(Array.from(selected)),
      }
    })
  }

  const createPolicyCategory = (category: string) => {
    const value = category.trim()
    if (!value) return
    setPolicyDraft((current) => ({
      ...current,
      categories: normalizeCategories([...current.categories, value]),
    }))
  }

  const removePolicyCategory = (category: string) => {
    setPolicyDraft((current) => ({
      ...current,
      categories: current.categories.filter((entry) => entry !== category),
    }))
  }

  const selectPolicyDocument = (file: File) => {
    const validationError = validatePdf(file)
    if (validationError) {
      toast.error(validationError)
      return
    }
    setPolicyDocumentRemoveRequested(false)
    setPolicyDocumentPending(file)
  }

  const clearPendingPolicyDocument = () => {
    setPolicyDocumentPending(null)
  }

  const markPolicyDocumentForRemoval = () => {
    if (!policyDraft.document?.path) return
    setPolicyDocumentPending(null)
    setPolicyDocumentRemoveRequested(true)
    setPolicyDraft((current) => ({ ...current, document: null }))
  }

  const openNewPolicyDialog = () => {
    setPolicyDraft(createEmptyPolicyDraft())
    setBaseline(createEmptyPolicyDraft())
    resetPolicyDocumentMutations()
    setPolicyDialogOpen(true)
  }

  const openEditPolicyDialog = (policy: DocumentsPolicyEntry) => {
    setPolicyDraft(toPolicyDraft(policy))
    setBaseline(toPolicyDraft(policy))
    resetPolicyDocumentMutations()
    setPolicyDialogOpen(true)
  }

  const handlePolicyDialogOpenChange = (open: boolean) => {
    setPolicyDialogOpen(open)
    if (!open) {
      resetPolicyDocumentMutations()
    }
  }

  return {
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
    setPolicyDocumentPending,
    setPolicyDocumentRemoveRequested,
    setPolicyDraft,
    togglePolicyCategory,
  }
}
