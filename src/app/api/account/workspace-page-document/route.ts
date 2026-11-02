import { handlePageDocumentPreview } from "@/features/workspace-sharing/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export async function GET(request: Request) { return handlePageDocumentPreview(request) }
