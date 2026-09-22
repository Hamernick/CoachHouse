import { checkEmailDeliveryPreferences } from "@/lib/email/delivery-preferences"
import { env } from "@/lib/env"
import { auditEmailContentForDelivery } from "@/lib/email/content-audit"
import { buildEmailUnsubscribeUrls } from "@/lib/email/preference-tokens"

type SendResendEmailInput = {
  to: string | string[]
  subject: string
  html: string
  text: string
  previewText?: string | null
  replyTo?: string | null
  tags?: Array<{ name: string; value: string }>
  idempotencyKey?: string | null
  unsubscribe?: {
    email: string
    topicId?: string | null
    campaignId?: string | null
    deliveryId?: string | null
    personId?: string | null
    origin?: string | null
  } | null
}

type SendResendEmailResult =
  | { ok: true; id: string | null }
  | { ok: false; error: string }

const RESEND_API_URL = "https://api.resend.com/emails"
const DEFAULT_FROM_NAME = "Coach House"
const RESEND_TAG_COMPONENT_PATTERN = /[^A-Za-z0-9_-]+/g
const RESEND_TAG_LIMIT = 75

function resolveReplyTo(input: string | null | undefined) {
  if (typeof input === "string" && input.trim().length > 0) return input.trim()
  if (
    typeof env.RESEND_REPLY_TO_EMAIL === "string" &&
    env.RESEND_REPLY_TO_EMAIL.trim().length > 0
  ) {
    return env.RESEND_REPLY_TO_EMAIL.trim()
  }
  return null
}

function resolveFallbackUnsubscribeHeaders(replyTo: string | null) {
  const unsubscribeEmail =
    typeof env.RESEND_UNSUBSCRIBE_EMAIL === "string" &&
    env.RESEND_UNSUBSCRIBE_EMAIL.trim().length > 0
      ? env.RESEND_UNSUBSCRIBE_EMAIL.trim()
      : replyTo
  const unsubscribeUrl =
    typeof env.RESEND_UNSUBSCRIBE_URL === "string" &&
    env.RESEND_UNSUBSCRIBE_URL.trim().length > 0
      ? env.RESEND_UNSUBSCRIBE_URL.trim()
      : null
  const listUnsubscribe = [
    unsubscribeEmail ? `<mailto:${unsubscribeEmail}>` : null,
    unsubscribeUrl ? `<${unsubscribeUrl}>` : null,
  ].filter(Boolean)

  if (listUnsubscribe.length === 0) return null

  return {
    "List-Unsubscribe": listUnsubscribe.join(", "),
    ...(unsubscribeUrl
      ? { "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }
      : {}),
  }
}

async function resolveUnsubscribeHeaders(
  replyTo: string | null,
  unsubscribe: SendResendEmailInput["unsubscribe"]
) {
  if (!unsubscribe)
    return {
      headers: resolveFallbackUnsubscribeHeaders(replyTo),
      unsubscribeUrl: null,
    }

  const urls = await buildEmailUnsubscribeUrls(unsubscribe)
  const unsubscribeEmail =
    typeof env.RESEND_UNSUBSCRIBE_EMAIL === "string" &&
    env.RESEND_UNSUBSCRIBE_EMAIL.trim().length > 0
      ? env.RESEND_UNSUBSCRIBE_EMAIL.trim()
      : replyTo
  const listUnsubscribe = [
    unsubscribeEmail ? `<mailto:${unsubscribeEmail}>` : null,
    `<${urls.oneClickUrl}>`,
  ].filter(Boolean)

  return {
    headers: {
      "List-Unsubscribe": listUnsubscribe.join(", "),
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
    unsubscribeUrl: urls.pageUrl,
  }
}

function resolveResendApiKey() {
  const canonicalKey = env.RESEND_API_KEY?.trim()
  if (canonicalKey) return canonicalKey

  return env.RESEND_AUTH_EMAIL_API_KEY?.trim() || null
}

export function normalizeResendTagComponent(value: string) {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(RESEND_TAG_COMPONENT_PATTERN, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "")

  return normalized || "unknown"
}

function normalizeResendTags(tags: SendResendEmailInput["tags"]) {
  if (!Array.isArray(tags) || tags.length === 0) return undefined

  return tags.slice(0, RESEND_TAG_LIMIT).map((tag) => ({
    name: normalizeResendTagComponent(tag.name),
    value: normalizeResendTagComponent(tag.value),
  }))
}

export function canSendResendEmail() {
  return Boolean(resolveResendApiKey() && env.RESEND_FROM_EMAIL?.trim())
}

export async function sendResendEmail(
  input: SendResendEmailInput
): Promise<SendResendEmailResult> {
  const resendApiKey = resolveResendApiKey()

  if (!resendApiKey) {
    return { ok: false, error: "RESEND_API_KEY is not configured." }
  }

  const fromEmail = env.RESEND_FROM_EMAIL?.trim()

  if (!fromEmail) {
    return { ok: false, error: "RESEND_FROM_EMAIL is not configured." }
  }
  const fromName =
    typeof env.RESEND_FROM_NAME === "string" &&
    env.RESEND_FROM_NAME.trim().length > 0
      ? env.RESEND_FROM_NAME.trim()
      : DEFAULT_FROM_NAME
  const replyTo = resolveReplyTo(input.replyTo)
  let unsubscribeHeaders: Record<string, string> | null = null
  let unsubscribeUrl: string | null = null

  try {
    const resolvedUnsubscribe = await resolveUnsubscribeHeaders(
      replyTo,
      input.unsubscribe
    )
    unsubscribeHeaders = resolvedUnsubscribe.headers
    unsubscribeUrl = resolvedUnsubscribe.unsubscribeUrl
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Unable to create unsubscribe link.",
    }
  }

  const audit = auditEmailContentForDelivery({
    subject: input.subject,
    html: input.html,
    text: input.text,
    previewText: input.previewText,
    unsubscribeUrl,
  })
  if (audit.blocked) {
    return {
      ok: false,
      error: `Email content failed safety checks: ${audit.issues
        .filter((issue) => issue.severity === "blocked")
        .map((issue) => issue.message)
        .join(" ")}`,
    }
  }
  if (input.unsubscribe) {
    try {
      const error = await checkEmailDeliveryPreferences(
        Array.isArray(input.to) ? input.to : [input.to],
        input.unsubscribe.topicId?.trim() || "product_updates"
      )
      if (error) return { ok: false, error }
    } catch {
      return {
        ok: false,
        error: "Unable to verify email preferences. No email was sent.",
      }
    }
  }
  const tags = normalizeResendTags(input.tags)

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
      ...(input.idempotencyKey
        ? { "Idempotency-Key": input.idempotencyKey }
        : {}),
    },
    body: JSON.stringify({
      from: `${fromName} <${fromEmail}>`,
      to: Array.isArray(input.to) ? input.to : [input.to],
      subject: input.subject,
      html: audit.sanitizedHtml,
      text: input.text,
      ...(replyTo ? { reply_to: replyTo } : {}),
      ...(unsubscribeHeaders ? { headers: unsubscribeHeaders } : {}),
      ...(tags ? { tags } : {}),
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => "")
    return {
      ok: false,
      error:
        body.trim() || `Resend request failed with status ${response.status}.`,
    }
  }

  const payload = (await response.json().catch(() => null)) as {
    id?: string | null
  } | null

  return { ok: true, id: payload?.id ?? null }
}
