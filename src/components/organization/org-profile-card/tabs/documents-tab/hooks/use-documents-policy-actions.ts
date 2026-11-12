import type { Dispatch, SetStateAction } from "react"
import { useState } from "react"

import { toast } from "@/lib/toast"
import { downloadFile } from "@/lib/download-file"
import type { DocumentActionOptions } from "./use-documents-library-selection"

import {
  deletePolicy,
  getPolicyDocumentUrl,
  removePolicyDocument,
  savePolicy,
  uploadPolicyDocument,
} from "../api"
import type { DocumentsPolicyEntry, PolicyDraft } from "../types"
import {
  buildSavePolicyPayload,
  toDraftDocumentPolicyEntry,
} from "./policy-draft-helpers"

type UseDocumentsPolicyActionsArgs = {
  setPoliciesState: Dispatch<SetStateAction<DocumentsPolicyEntry[]>>
  policyDraft: PolicyDraft
  policyDocumentPending: File | null
  policyDocumentRemoveRequested: boolean
  setPolicyDialogOpen: (open: boolean) => void
  setPolicyDocumentBusy: (busy: boolean) => void
  resetPolicyDocumentMutations: () => void
}

export function useDocumentsPolicyActions({
  setPoliciesState,
  policyDraft,
  policyDocumentPending,
  policyDocumentRemoveRequested,
  setPolicyDialogOpen,
  setPolicyDocumentBusy,
  resetPolicyDocumentMutations,
}: UseDocumentsPolicyActionsArgs) {
  const [deletingPolicyId, setDeletingPolicyId] = useState<string | null>(null)
  const [viewingPolicyDocumentId, setViewingPolicyDocumentId] = useState<
    string | null
  >(null)
  const [downloadingPolicyDocumentId, setDownloadingPolicyDocumentId] =
    useState<string | null>(null)
  const [policySavePending, setPolicySavePending] = useState(false)

  const viewPolicyDocument = async (policy: DocumentsPolicyEntry) => {
    if (!policy.document?.path) return
    setViewingPolicyDocumentId(policy.id)
    try {
      const url = await getPolicyDocumentUrl(policy.id)
      window.open(url, "_blank", "noopener")
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Unable to open policy file"
      )
    } finally {
      setViewingPolicyDocumentId(null)
    }
  }

  const viewPolicyDraftDocument = () => {
    const entry = toDraftDocumentPolicyEntry(policyDraft)
    if (!entry) return
    void viewPolicyDocument(entry)
  }

  const handleSavePolicy = async () => {
    const payload = buildSavePolicyPayload(policyDraft)
    if (!payload.title) {
      toast.error("Policy title is required.")
      return
    }

    setPolicySavePending(true)
    try {
      const policyId = await savePolicy(payload)

      if (policyDocumentRemoveRequested) {
        setPolicyDocumentBusy(true)
        await removePolicyDocument(policyId)
      }

      if (policyDocumentPending) {
        setPolicyDocumentBusy(true)
        await uploadPolicyDocument(policyId, policyDocumentPending)
      }

      setPolicyDialogOpen(false)
      resetPolicyDocumentMutations()
      toast.success(policyDraft.id ? "Policy updated" : "Policy created")
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Unable to save policy"
      )
    } finally {
      setPolicySavePending(false)
      setPolicyDocumentBusy(false)
    }
  }

  const handleDeletePolicy = async (policy: DocumentsPolicyEntry) => {
    if (!window.confirm("Delete this policy?")) return
    setDeletingPolicyId(policy.id)
    try {
      await deletePolicy(policy.id)
      setPoliciesState((current) =>
        current.filter((entry) => entry.id !== policy.id)
      )
      toast.success("Policy deleted")
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Unable to delete policy"
      )
    } finally {
      setDeletingPolicyId(null)
    }
  }

  const downloadPolicyDocument = async (
    policy: DocumentsPolicyEntry,
    options: DocumentActionOptions = {}
  ) => {
    if (!policy.document?.path) return
    setDownloadingPolicyDocumentId(policy.id)
    try {
      const url = await getPolicyDocumentUrl(policy.id, { download: true })
      await downloadFile(url, policy.document.name || policy.title)
    } catch (error: unknown) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to download policy file"
      )
      if (options.throwOnError) throw error
    } finally {
      setDownloadingPolicyDocumentId(null)
    }
  }

  const removePolicyDocumentFile = async (
    policy: DocumentsPolicyEntry,
    options: DocumentActionOptions = {}
  ) => {
    if (!policy.document?.path) return
    if (
      options.confirm !== false &&
      !window.confirm("Remove this policy document?")
    ) {
      return
    }
    setDeletingPolicyId(policy.id)
    try {
      await removePolicyDocument(policy.id)
      toast.success("Policy document removed")
    } catch (error: unknown) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to remove policy document"
      )
      if (options.throwOnError) throw error
    } finally {
      setDeletingPolicyId(null)
    }
  }

  return {
    deletingPolicyId,
    downloadingPolicyDocumentId,
    downloadPolicyDocument,
    handleDeletePolicy,
    handleSavePolicy,
    policySavePending,
    removePolicyDocumentFile,
    viewingPolicyDocumentId,
    viewPolicyDocument,
    viewPolicyDraftDocument,
  }
}
