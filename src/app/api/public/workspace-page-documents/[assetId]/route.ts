import { handlePageDocument } from "@/features/workspace-sharing/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export async function GET(request: Request, context: { params: Promise<{ assetId: string }> }) {
  return handlePageDocument(request, (await context.params).assetId)
}
