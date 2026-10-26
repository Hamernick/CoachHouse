import { handleCompanionOAuthRoute } from "@/features/coach-house-companion/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const GET = handleCompanionOAuthRoute
export const POST = handleCompanionOAuthRoute
