import Stripe from "stripe"
import { getSubscriptionPeriodEndIso } from "@/lib/billing/subscription-period"
import type { Database } from "@/lib/supabase"

export type WebhookEventPayload = {
  stripe_event: unknown
  processed: boolean
  received_at: string
  processed_at?: string
  failed_at?: string
  error?: string
}

export function toWebhookPayload(
  event: Stripe.Event,
  patch: Partial<WebhookEventPayload>,
): WebhookEventPayload {
  return {
    stripe_event: event,
    processed: false,
    received_at: new Date().toISOString(),
    ...patch,
  }
}

export function extractUserIdFromMetadata(metadata: Stripe.Metadata) {
  const candidate = metadata.user_id ?? metadata.userId
  if (candidate && typeof candidate === "string") {
    return candidate
  }
  return undefined
}

export function extractOrganizationUserIdFromMetadata(metadata: Stripe.Metadata) {
  const candidate = metadata.org_user_id
  if (candidate && typeof candidate === "string") {
    return candidate
  }
  return undefined
}

export function toStatus(
  value: string,
): Database["public"]["Enums"]["subscription_status"] {
  const allowed: Database["public"]["Enums"]["subscription_status"][] = [
    "trialing",
    "active",
    "past_due",
    "canceled",
    "incomplete",
    "incomplete_expired",
  ]
  if (allowed.includes(value as Database["public"]["Enums"]["subscription_status"])) {
    return value as Database["public"]["Enums"]["subscription_status"]
  }
  return "incomplete"
}

export function getCurrentPeriodEndIso(subscription: Stripe.Subscription) {
  return getSubscriptionPeriodEndIso(subscription)
}

function getStripeTimestampIso(value: number | null | undefined) {
  return typeof value === "number" ? new Date(value * 1000).toISOString() : null
}

export function getCancelAtIso(subscription: Stripe.Subscription) {
  return getStripeTimestampIso(subscription.cancel_at)
}

export function getCanceledAtIso(subscription: Stripe.Subscription) {
  return getStripeTimestampIso(subscription.canceled_at)
}
