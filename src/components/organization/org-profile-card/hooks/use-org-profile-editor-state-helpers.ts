import { prepareCoreDocumentProfileSave } from "@/lib/roadmap/core-document-publication"
import type { OrgProfile, OrgProfileErrors } from "../types"

export function applyOrgProfileUpdates(
  previousProfile: OrgProfile,
  updates: Partial<OrgProfile>,
): OrgProfile {
  const nextProfile: OrgProfile = { ...previousProfile }
  const mutable = nextProfile as Record<keyof OrgProfile, OrgProfile[keyof OrgProfile]>
  const keys = Object.keys(updates) as Array<keyof OrgProfile>

  for (const key of keys) {
    const value = updates[key]
    if (typeof value === "boolean") {
      mutable[key] = value
    } else if (Array.isArray(value)) {
      mutable[key] = value
    } else {
      mutable[key] = (value ?? "") as OrgProfile[typeof key]
    }
  }

  return nextProfile
}

export function clearOrgProfileErrors(
  previousErrors: OrgProfileErrors,
  updates: Partial<OrgProfile>,
): OrgProfileErrors {
  const nextErrors = { ...previousErrors }
  const keys = Object.keys(updates) as Array<keyof OrgProfile>

  for (const key of keys) {
    nextErrors[key] = ""
  }

  return nextErrors
}

export function mapOrgProfileFieldErrors(
  fieldErrors: Record<string, string[] | undefined>,
): OrgProfileErrors {
  const nextErrors: OrgProfileErrors = {}
  for (const [key, value] of Object.entries(fieldErrors)) {
    if (value && value.length > 0) {
      nextErrors[key] = value[0] as string
    }
  }
  return nextErrors
}

export function prepareOrgProfileSave(company: OrgProfile, saved: OrgProfile) {
  const payload = prepareCoreDocumentProfileSave(company, saved)
  if (JSON.stringify(company.brandIdentity) === JSON.stringify(saved.brandIdentity)) delete payload.brandIdentity
  return payload
}

export function acknowledgeOrgProfileSave(company: OrgProfile, result: {
  brandIdentity?: OrgProfile["brandIdentity"]
  narrativeRevisions?: OrgProfile["narrativeRevisions"]
  coreDocumentPublication?: OrgProfile["coreDocumentPublication"]
}): OrgProfile {
  return { ...company,
    ...(result.brandIdentity ? { brandIdentity: result.brandIdentity } : {}),
    ...(result.narrativeRevisions ? { narrativeRevisions: result.narrativeRevisions } : {}),
    ...(result.coreDocumentPublication ? { coreDocumentPublication: result.coreDocumentPublication } : {}),
  }
}
