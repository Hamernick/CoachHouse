import type { AiDocumentTarget } from "../../../src/features/workspace-ai/types"
import type { quoteDocumentAssistance as Quote, readDocumentAssistance as Read } from "../../../src/features/workspace-ai/actions"
import type { saveRoadmapSectionAction as Save } from "../../../src/actions/roadmap"

async function request(path: string, body?: unknown) {
  const response = await fetch(`/__fixture/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error)
  return result
}
export const quoteDocumentAssistance: typeof Quote = (target: AiDocumentTarget) => request("quote", target)
export const readDocumentAssistance: typeof Read = (id, target) => request("read", { id, target })
export const stopDocumentAssistance = (id: string) => request("stop", { id })
export const saveRoadmapSectionAction: typeof Save = input => request("save", input)
export const readFixture = () => request("state")

// Next navigation and uploads are intentionally unavailable in this isolated runtime.
export const usePathname = () => "/workspace"
export const validateOrgMediaFile = () => "Uploads are unavailable in this fixture."
export const uploadOrgMedia = async () => { throw new Error("Uploads are unavailable in this fixture.") }

export const quoteSelectionAssistance = () => request("quote-selection")

// Research is tested separately; prevent server modules entering this browser fixture.
export const quoteWorkspaceResearch = async () => ({ error: "Research is unavailable in this fixture." })
export const getWorkspaceResearch = async () => ({ error: "Research is unavailable in this fixture." })
export const stopWorkspaceResearch = async () => ({ error: "Research is unavailable in this fixture." })
