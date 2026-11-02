import { handlePageImage } from "@/features/workspace-sharing/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export async function GET(request: Request, context: { params: Promise<{ assetId: string }> }) {
  return handlePageImage(request, (await context.params).assetId)
}
