import type { DocumentDefinition, DocumentsPolicyEntry } from "@/lib/organization/document-types"
export type { DocumentDefinition, DocumentsPolicyEntry } from "@/lib/organization/document-types"
import type { ModuleNoteIndexEntry } from "@/lib/modules/notes-index"

import type { OrgDocument, OrgDocuments } from "../../types"

export type DocumentStatus =
  | "missing"
  | "not_started"
  | "in_progress"
  | "ready"
  | "published"
export type DocumentSource = "upload" | "policy" | "roadmap"
export type DocumentVisibility = "private" | "public"

export type SortColumn =
  | "status"
  | "name"
  | "category"
  | "source"
  | "visibility"
  | "updatedAt"
export type SortDirection = "asc" | "desc"

export type DocumentsRoadmapSection = {
  content?: string
  hasContent?: boolean
  id: string
  title: string
  subtitle: string
  slug: string
  status: "not_started" | "in_progress" | "complete"
  lastUpdated: string | null
  isPublic: boolean
}

export type DocumentsOption = {
  id: string
  label: string
}

export type UploadRow = {
  id: string
  source: "upload"
  name: string
  description: string
  categories: string[]
  status: DocumentStatus
  visibility: "private"
  updatedAt: string | null
  definition: DocumentDefinition
  document: OrgDocument | null
}

export type PolicyRow = {
  id: string
  source: "policy"
  name: string
  description: string
  categories: string[]
  status: DocumentStatus
  visibility: "private"
  updatedAt: string | null
  policy: DocumentsPolicyEntry
}

export type RoadmapRow = {
  id: string
  source: "roadmap"
  name: string
  description: string
  categories: string[]
  status: DocumentStatus
  visibility: DocumentVisibility
  updatedAt: string | null
  section: DocumentsRoadmapSection
}

export type DocumentIndexRow = UploadRow | PolicyRow | RoadmapRow

export type DocumentsTabProps = {
  organizationId: string
  userId: string
  documents?: OrgDocuments | null
  policyEntries: DocumentsPolicyEntry[]
  policyProgramOptions: DocumentsOption[]
  policyPeopleOptions: DocumentsOption[]
  roadmapSections: DocumentsRoadmapSection[]
  publicSlug?: string | null
  editMode: boolean
  canEdit: boolean
  initialFocusKey?: string | null
  notes?: ModuleNoteIndexEntry[]
}

export type PolicyDraft = {
  id?: string
  title: string
  summary: string
  status: DocumentsPolicyEntry["status"]
  categories: string[]
  programId: string
  personIds: string[]
  document: OrgDocument | null
}
