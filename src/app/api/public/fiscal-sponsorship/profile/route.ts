import { handleGuestFiscalProfile } from "@/features/fiscal-sponsorship"
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export async function POST(request: Request) {
  if (process.env.FISCAL_GUEST_PROFILE_IMPORT_ENABLED !== "true") return Response.json({ error: "Profile import is not available yet." }, { status: 503, headers: { "Cache-Control": "no-store" } })
  return handleGuestFiscalProfile(request)
}
