import { handleWorkspaceAiDocument } from "@/features/workspace-ai/server"

export const runtime = "nodejs"
export const maxDuration = 120
export const POST = handleWorkspaceAiDocument
