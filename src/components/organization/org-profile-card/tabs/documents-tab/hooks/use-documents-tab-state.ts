import type { Dispatch, SetStateAction } from "react"
import type { OrgDocuments } from "../../../types"
import type { DocumentsPolicyEntry } from "../types"
import type { ProfileDocumentLibrary } from "./use-profile-document-library"

/** A delayed mutation may update only the library generation that admitted it. */
export function useDocumentsTabState({ library }: { library: ProfileDocumentLibrary }) {
  const update = library.captureUpdate()
  const setDocumentsState: Dispatch<SetStateAction<OrgDocuments>> = next => update(current => ({
    ...current, documents: typeof next === "function" ? next(current.documents) : next,
  }))
  const setPoliciesState: Dispatch<SetStateAction<DocumentsPolicyEntry[]>> = next => update(current => ({
    ...current, policyEntries: typeof next === "function" ? next(current.policyEntries) : next,
  }))
  return { documentsState: library.data?.documents ?? {}, policiesState: library.data?.policyEntries ?? [], setDocumentsState, setPoliciesState }
}
