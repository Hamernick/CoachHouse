import { NextResponse, type NextRequest } from "next/server"
import { Resend } from "resend"

import { recordVerifiedFiscalDelivery } from "@/lib/email/fiscal-delivery"
import { env } from "@/lib/env"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"

type ResendWebhookEvent = {
  id?: string
  type?: string
  created_at?: string
  data?: unknown
}

function getStringField(record: Record<string, unknown>, key: string) {
  const value = record[key]
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function resolveOccurredAt(event: ResendWebhookEvent) {
  const createdAt = event.created_at
  if (createdAt) {
    const parsed = new Date(createdAt)
    if (Number.isFinite(parsed.getTime())) return parsed.toISOString()
  }

  return new Date().toISOString()
}

function resolveProviderMessageId(event: ResendWebhookEvent) {
  const data =
    event.data && typeof event.data === "object"
      ? (event.data as Record<string, unknown>)
      : {}
  return (
    getStringField(data, "email_id") ??
    getStringField(data, "emailId") ??
    getStringField(data, "message_id") ??
    getStringField(data, "messageId") ??
    getStringField(data, "id")
  )
}

function resolveRecipientEmail(event: ResendWebhookEvent, fallbackEmail?: string | null) {
  if (fallbackEmail) return fallbackEmail.trim().toLowerCase()

  const data =
    event.data && typeof event.data === "object"
      ? (event.data as Record<string, unknown>)
      : {}
  const to = data.to
  if (typeof to === "string" && to.trim()) return to.trim().toLowerCase()
  if (Array.isArray(to)) {
    const first = to.find((entry) => typeof entry === "string" && entry.trim())
    if (typeof first === "string") return first.trim().toLowerCase()
  }

  return (
    getStringField(data, "email") ??
    getStringField(data, "recipient") ??
    getStringField(data, "recipient_email")
  )?.toLowerCase() ?? null
}

function mapResendEventTypeToDeliveryStatus(eventType: string) {
  if (eventType === "email.sent") return "sent"
  if (eventType === "email.delivered") return "delivered"
  if (eventType === "email.opened") return "opened"
  if (eventType === "email.clicked") return "clicked"
  if (eventType === "email.bounced") return "bounced"
  if (eventType === "email.complained") return "complained"
  if (eventType === "email.unsubscribed") return "unsubscribed"
  if (eventType === "email.failed") return "failed"

  return null
}

function mapResendEventTypeToSuppressionReason(eventType: string) {
  if (eventType === "email.bounced") return "bounce"
  if (eventType === "email.complained") return "complaint"
  if (eventType === "email.unsubscribed") return "unsubscribe"
  return null
}

async function ensureSuppression({
  email,
  reason,
  eventType,
  providerEventId,
}: {
  email: string
  reason: string
  eventType: string
  providerEventId: string
}) {
  const supabase = createSupabaseAdminClient()
  const { data: existing, error: existingError } = await supabase
    .from("platform_email_suppressions")
    .select("id")
    .eq("email", email)
    .eq("reason", reason)
    .maybeSingle()

  if (existingError) return existingError
  if (existing) return null

  const { error } = await supabase.from("platform_email_suppressions").insert({
    email,
    reason,
    source: "resend_webhook",
    metadata: {
      eventType,
      providerEventId,
    },
  })

  return error
}

export async function POST(request: NextRequest) {
  const webhookSecret = env.RESEND_WEBHOOK_SECRET?.trim()
  if (!webhookSecret) {
    return new NextResponse("RESEND_WEBHOOK_SECRET is not configured.", {
      status: 503,
    })
  }

  const id = request.headers.get("svix-id")
  const timestamp = request.headers.get("svix-timestamp")
  const signature = request.headers.get("svix-signature")
  if (!id || !timestamp || !signature) {
    return new NextResponse("Missing Resend webhook signature headers.", {
      status: 400,
    })
  }

  const payload = await request.text()
  const resend = new Resend(
    env.RESEND_API_KEY?.trim() || env.RESEND_AUTH_EMAIL_API_KEY?.trim()
  )
  let event: ResendWebhookEvent

  try {
    event = resend.webhooks.verify({
      payload,
      headers: { id, timestamp, signature },
      webhookSecret,
    }) as unknown as ResendWebhookEvent
  } catch (error) {
    console.error("[resend-webhook] Invalid signature.", error)
    return new NextResponse("Invalid webhook signature.", { status: 400 })
  }

  const eventType = event.type?.trim()
  if (!eventType) {
    return new NextResponse("Missing Resend event type.", { status: 400 })
  }

  let fiscal = false
  try {
    fiscal = await recordVerifiedFiscalDelivery(id, event)
    if (fiscal && !mapResendEventTypeToSuppressionReason(eventType)) return NextResponse.json({ ok: true })
  } catch {
    // Non-2xx keeps the provider retryable. Do not log private webhook contents.
    return new NextResponse("Unable to record fiscal delivery.", { status: 503 })
  }

  const providerMessageId = resolveProviderMessageId(event)
  const occurredAt = resolveOccurredAt(event)
  const supabase = createSupabaseAdminClient()
  let deliveryId: string | null = null
  let campaignId: string | null = null
  let recipientEmail: string | null = null

  if (providerMessageId && !fiscal) {
    const { data: delivery, error: deliveryError } = await supabase
      .from("platform_email_deliveries")
      .select("id,campaign_id,recipient_email")
      .eq("provider_message_id", providerMessageId)
      .maybeSingle()

    if (deliveryError) {
      console.error("[resend-webhook] Unable to load delivery.", deliveryError)
    } else if (delivery) {
      deliveryId = delivery.id
      campaignId = delivery.campaign_id
      recipientEmail = delivery.recipient_email
    }
  }
  recipientEmail = resolveRecipientEmail(event, recipientEmail)

  if (!fiscal) {
    const { error: eventError } = await supabase
      .from("platform_email_events")
      .upsert(
        {
          provider: "resend",
          provider_event_id: id,
          event_type: eventType,
          occurred_at: occurredAt,
          campaign_id: campaignId,
          delivery_id: deliveryId,
          payload: event,
        },
        { onConflict: "provider_event_id" }
      )

    if (eventError) {
      console.error("[resend-webhook] Unable to persist event.", eventError)
      return new NextResponse("Unable to persist webhook event.", { status: 500 })
    }
  }

  const nextStatus = mapResendEventTypeToDeliveryStatus(eventType)
  if (deliveryId && nextStatus) {
    const updatePayload = {
      status: nextStatus,
      ...(nextStatus === "sent" ? { sent_at: occurredAt } : {}),
      ...(nextStatus === "delivered" ? { delivered_at: occurredAt } : {}),
    }
    const { error: updateError } = await supabase
      .from("platform_email_deliveries")
      .update(updatePayload)
      .eq("id", deliveryId)

    if (updateError) {
      console.error("[resend-webhook] Unable to update delivery.", updateError)
      return new NextResponse("Unable to update delivery.", { status: 500 })
    }
  }

  const suppressionReason = mapResendEventTypeToSuppressionReason(eventType)
  if (suppressionReason && recipientEmail) {
    const suppressionError = await ensureSuppression({
      email: recipientEmail,
      reason: suppressionReason,
      eventType,
      providerEventId: id,
    })
    if (suppressionError) {
      console.error("[resend-webhook] Unable to persist suppression.", suppressionError)
      return new NextResponse("Unable to persist suppression.", { status: 500 })
    }

    const { error: consentError } = await supabase
      .from("platform_email_consent_events")
      .insert({
        email: recipientEmail,
        topic_id: null,
        action:
          suppressionReason === "unsubscribe"
            ? "global_unsubscribe"
            : "provider_suppression",
        source: "resend_webhook",
        campaign_id: campaignId,
        delivery_id: deliveryId,
        metadata: {
          eventType,
          providerEventId: id,
          suppressionReason,
        },
      })

    if (consentError) {
      console.error("[resend-webhook] Unable to persist consent event.", consentError)
      return new NextResponse("Unable to persist consent event.", { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}
