import "server-only"

import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { authorizeFiscalEmailCron } from "./staff-email-dispatch"

export async function handleGuestFiscalDraftRetention(request: Request) {
  const headers = { "Cache-Control": "no-store" }
  if (!authorizeFiscalEmailCron(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers })
  // Independent from submission/email flags: cleanup must continue after intake closes.
  if (process.env.FISCAL_GUEST_RETENTION_ENABLED !== "true") return NextResponse.json({ error: "Draft cleanup is not enabled" }, { status: 503, headers })
  try {
    const { data, error } = await createSupabaseAdminClient().rpc("purge_expired_fiscal_guest_drafts")
    if (error || !Number.isInteger(data) || data < 0 || data > 500) throw new Error("cleanup_unavailable")
    const proofs = await createSupabaseAdminClient().rpc("purge_expired_fiscal_guest_proofs")
    if (proofs.error || !Number.isInteger(proofs.data) || proofs.data < 0 || proofs.data > 500) throw new Error("cleanup_unavailable")
    let deliveryEventsDeleted = 0
    if (process.env.FISCAL_EMAIL_TRACKING_ENABLED === "true") {
      const events = await createSupabaseAdminClient().rpc("purge_fiscal_email_delivery_events")
      if (events.error || !Number.isInteger(events.data) || events.data < 0 || events.data > 500) throw new Error("cleanup_unavailable")
      deliveryEventsDeleted = events.data
    }
    return NextResponse.json({ deleted: data, proofsDeleted: proofs.data, deliveryEventsDeleted, morePossible: data === 500 || proofs.data >= 250 || deliveryEventsDeleted === 500 }, { headers })
  } catch { return NextResponse.json({ error: "Draft cleanup unavailable" }, { status: 503, headers }) }
}
