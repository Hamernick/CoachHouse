import { handleGuestFiscalSession } from "@/features/fiscal-sponsorship"

export const runtime = "nodejs"
export const maxDuration = 60
export const dynamic = "force-dynamic"

export async function POST(request: Request) { return handleGuestFiscalSession(request) }
