export type AiDocumentTarget = { organizationId: string; userId: string; sectionId: string; title: string; revision: string | null }
export type AiDocumentApplication = { run_id:string; section_id:string; saved_revision:string; content_hash:string; saved_at:string }
export type AiDocumentRequest = { id: string; target: AiDocumentTarget; prompt: string; maximumCredits: number; tariffVersion: string; reviseRunId?:string }
export type AiDocumentProposal = {
  id: string; target: AiDocumentTarget; original: string; content: string;
  status: string; credits: number | null; maxCredits: number
  application?: AiDocumentApplication | null
  revisionSourceRunId?: string
}
export type AiStreamPart =
  | { type: "start"; id: string }
  | { type: "text"; text: string }
  | { type: "proposal"; proposal: AiDocumentProposal }
  | { type: "error"; message: string; id: string }
