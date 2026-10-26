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

export type CompanionToolResult = { snapshot: CompanionSnapshot; message: string }
export type CompanionTransport = (name: CompanionToolName, args: CompanionToolArguments) => Promise<CompanionToolResult>
export type CompanionPrincipal = { sessionId: string; organizationId: string; expiresAt: number }
