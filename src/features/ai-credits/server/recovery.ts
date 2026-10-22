import "server-only"

import { timingSafeEqual } from "node:crypto"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export async function handleAiRecovery(request: Request) {
  const headers = { "Cache-Control": "no-store" }
  const secret = process.env.INTERNAL_CRON_SECRET?.trim() || process.env.CRON_SECRET?.trim()
  const supplied = request.headers.get("authorization")
  const expected = secret ? `Bearer ${secret}` : null
  if (!expected || !supplied || Buffer.byteLength(expected) !== Buffer.byteLength(supplied)
    || !timingSafeEqual(Buffer.from(expected),Buffer.from(supplied)))
    return Response.json({ error: "Unauthorized" },{ status: 401,headers })
  // Recovery remains separately enabled when generation is stopped by the kill
  // switch. Status reads also recover the caller's authorized organization.
  if (process.env.WORKSPACE_AI_RECOVERY_ENABLED !== "true")
    return Response.json({ error: "AI recovery is not enabled" },{ status: 503,headers })
  try {
    const { data,error } = await createSupabaseAdminClient({ requestTimeoutMs: 20000 }).rpc("recover_workspace_ai_runs",{})
    if (error || !Number.isInteger(data) || data < 0 || data > 100) throw new Error("Recovery unavailable")
    return Response.json({ recovered: data,morePossible: data === 100 },{ headers })
  } catch { return Response.json({ error: "AI recovery unavailable" },{ status: 503,headers }) }
}
