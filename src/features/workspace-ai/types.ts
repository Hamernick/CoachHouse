export type AiDocumentTarget = { organizationId: string; userId: string; sectionId: string; title: string; revision: string | null }
export type AiDocumentRequest = { id: string; target: AiDocumentTarget; prompt: string; maximumCredits: number; tariffVersion: string }
export type AiDocumentProposal = {
  id: string; target: AiDocumentTarget; original: string; content: string;
  status: string; credits: number | null; maxCredits: number
}
export type AiStreamPart =
  | { type: "start"; id: string }
  | { type: "text"; text: string }
  | { type: "proposal"; proposal: AiDocumentProposal }
  | { type: "error"; message: string; id: string }
