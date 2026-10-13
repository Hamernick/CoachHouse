import { handleGuestFiscalFollowup } from "@/features/fiscal-sponsorship"
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export async function POST(request: Request) { return handleGuestFiscalFollowup(request) }
