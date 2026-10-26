export type CompanionField = { name: string; label: string; description?: string; required: boolean }

export type CompanionReceipt = { id: string; action: string; at: string; message: string }

export type CompanionSnapshot = {
  mode: "sandbox"
  organization: { id: string; name: string }
  lesson: {
    id: string
    title: string
    description: string
    href: string
    fields: CompanionField[]
    completionMode: "all_answered" | "any_answer"
    completeOnSubmit: boolean
  }
  source: { kind: "published" | "repository_fixture"; label: string; verifiedAt: string | null }
  draft: { answers: Record<string, string>; revision: number; updatedAt: string | null }
  document: { id: string; title: string; content: string; revision: number; visibility: "sandbox" }
  submission: { status: "not_submitted" | "submitted"; completed: boolean; submittedAt: string | null }
  calendar: {
    capability: "export"
    event: null | {
      id: string
      title: string
      startsAt: string
      endsAt: string
      timeZone: string
      status: "export_ready"
      ics: string
    }
  }
  receipts: CompanionReceipt[]
}

export type CompanionToolName =
  | "companion_get_session"
  | "companion_review_document"
  | "companion_save_draft"
  | "companion_save_document"
  | "companion_submit_assignment"
  | "companion_schedule_block"

export type CompanionToolArguments = {
  organizationId: string
  requestId?: string
  expectedRevision?: number
  answers?: Record<string, string>
  content?: string
  confirmed?: boolean
  title?: string
  startsAt?: string
  endsAt?: string
  timeZone?: string
}

export type CompanionProposal = { organizationId: string; documentId: string; content: string; expectedRevision: number }
export type CompanionToolResult = { snapshot: CompanionSnapshot; message: string; proposal?: CompanionProposal }
export type CompanionTransport = (name: CompanionToolName, args: CompanionToolArguments) => Promise<CompanionToolResult>
export type CompanionPrincipal = { sessionId: string; organizationId: string; expiresAt: number }

// Live uses the app's typed assignment model; sandbox contracts remain unchanged.
export type LiveCompanionContext = {
  supabase: import("@supabase/supabase-js").SupabaseClient<import("@/lib/supabase").Database>
  userId: string
  clientId: string
  accessToken: string
  scopes: string[]
  appOrigin?: string
}
export type LiveCompanionToolName = CompanionToolName | "companion_list_organizations" | "companion_list_lessons"
export type LiveCompanionToolArguments = {
  expectedSubmissionRevision?: string | null
  organizationId?: string
  lessonId?: string
  documentId?: string
  requestId?: string
  expectedRevision?: number | string
  answers?: Record<string, unknown>
  content?: string
  confirmed?: boolean
  title?: string
  startsAt?: string
  endsAt?: string
  timeZone?: string
}
export type LiveCompanionSnapshot = Omit<CompanionSnapshot, "mode" | "lesson" | "draft" | "document" | "submission"> & {
  mode: "connected"
  lesson: Omit<CompanionSnapshot["lesson"], "fields" | "completionMode"> & {
    fields: import("@/lib/modules/types").ModuleAssignmentField[]
    completionMode: "on_submit" | "all_answered"
    body: string
    videoUrl: string | null
    resources: Array<{ label: string; url: string }>
  }
  draft: { answers: Record<string, unknown>; revision: number; updatedAt: string | null; visibility: "personal" }
  document: { id: string; title: string; content: string; revision: string; visibility: "organization"; href: string }
  submission: { status: "not_submitted" | "submitted" | "accepted" | "revise"; completed: boolean; submittedAt: string | null; answers: Record<string, unknown> }
  coachingHref: string
}
export type LiveCompanionProposal = Omit<CompanionProposal, "expectedRevision"> & { expectedRevision: string; visibility: "organization"; lessonId: string }
export type LiveCompanionToolResult = {
  message: string
  snapshot?: LiveCompanionSnapshot
  proposal?: LiveCompanionProposal
  organizations?: Array<{ id: string; name: string; role: string; hasAcceleratorAccess: boolean }>
  lessons?: Array<{ id: string; title: string; href: string; completed: boolean }>
}

export type CompanionConsentState =
  | { status: "login"; href: string }
  | { status: "redirect"; href: string }
  | { status: "unavailable"; message: string }
  | { status: "ready"; authorizationId: string; csrfToken: string; clientName: string; clientWebsite: string | null; accountEmail: string; scopes: string[] }
