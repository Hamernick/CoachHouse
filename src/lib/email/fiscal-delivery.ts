import "server-only"

import { z } from "zod"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

const categories = new Set(["fiscal-receipt", "fiscal-review", "fiscal-staff-update"])
const deliveryEvent = z.object({
  type: z.enum(["email.sent", "email.delivered", "email.delivery_delayed", "email.bounced", "email.complained", "email.failed", "email.suppressed"]),
  created_at: z.string().datetime({ offset: true }),
  data: z.object({ email_id: z.string().min(1).max(200) }),
})

// Call only after Resend verifies the original request body and Svix headers.
// Fiscal messages never enter the campaign ledger with raw recipient/link data.
export async function recordVerifiedFiscalDelivery(providerEventId: string, event: unknown) {
  const envelope = z.object({ data: z.object({ tags: z.record(z.string(), z.unknown()).optional() }) }).safeParse(event)
  if (!envelope.success || !categories.has(String(envelope.data.data.tags?.category))) return false
  const type = z.object({ type: z.string() }).parse(event).type
  if (!["email.sent", "email.delivered", "email.delivery_delayed", "email.bounced", "email.complained", "email.failed", "email.suppressed"].includes(type)) return true
  // Independent of dispatch: pausing sends must not discard in-flight receipts.
  if (process.env.FISCAL_EMAIL_TRACKING_ENABLED !== "true") throw new Error("Fiscal email tracking is not configured")
  const parsed = deliveryEvent.parse(event)
  const { error } = await createSupabaseAdminClient().rpc("record_fiscal_email_delivery", {
    p_event_id: z.string().min(1).max(200).parse(providerEventId),
    p_message_id: parsed.data.email_id,
    p_event_type: parsed.type,
    p_occurred_at: parsed.created_at,
  })
  if (error) throw new Error("Fiscal email event could not be recorded")
  return true
}
