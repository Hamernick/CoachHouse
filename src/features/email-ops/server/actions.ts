"use server"

import { requireAdmin } from "@/lib/admin/auth"
import { sendResendEmail } from "@/lib/email/resend"
import { env } from "@/lib/env"
import { buildEmailOpsCampaignEmail } from "../lib/campaign-email"

import {
  findEmailOpsCampaign,
  normalizeEmailOpsTestSendInput,
} from "../lib"
import type { EmailOpsActionResult } from "../types"

const EMAIL_ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function sendEmailOpsTestEmailAction(
  formData: FormData
): Promise<EmailOpsActionResult> {
  await requireAdmin()

  const input = normalizeEmailOpsTestSendInput({
    campaignId: String(formData.get("campaignId") ?? ""),
    to: String(formData.get("to") ?? ""),
  })

  if (!input.campaignId) {
    return { ok: false, message: "Choose a campaign before sending a test." }
  }
  if (!EMAIL_ADDRESS_PATTERN.test(input.to)) {
    return { ok: false, message: "Enter a valid recipient email address." }
  }

  const campaign = findEmailOpsCampaign(input.campaignId)
  if (!campaign) {
    return { ok: false, message: "This campaign is not available." }
  }

  const result = await sendResendEmail({
    to: input.to,
    ...buildEmailOpsCampaignEmail(campaign, env.NEXT_PUBLIC_SITE_URL || "https://coachhouse.app"),
    subject: `[Test] ${campaign.subject}`,
    previewText: campaign.previewText,
    unsubscribe: {
      email: input.to,
      topicId: "product_updates",
      campaignId: null,
      deliveryId: null,
    },
    idempotencyKey: `email-ops-test/${campaign.id}/${input.to}/${new Date()
      .toISOString()
      .slice(0, 16)}`,
    tags: [
      { name: "category", value: "email-ops-test" },
      { name: "campaign", value: campaign.id },
    ],
  })

  if (!result.ok) return { ok: false, message: result.error }

  return {
    ok: true,
    message: "Test email queued through Resend.",
    providerId: result.id,
  }
}
