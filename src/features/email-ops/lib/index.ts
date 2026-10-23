import { canSendResendEmail } from "@/lib/email/resend"
import { canCreateEmailPreferenceTokens } from "@/lib/email/preference-tokens"
import { env } from "@/lib/env"
import { EMAIL_OPS_CAMPAIGNS, findEmailOpsCampaign } from "./campaigns"
export { findEmailOpsCampaign } from "./campaigns"
export { renderEmailOpsMarkdownHtml, renderEmailOpsMarkdownText } from "./campaign-content"

import type {
  EmailOpsCampaign,
  EmailOpsDashboardInput,
  EmailOpsHeatmapPoint,
  EmailOpsProviderStatus,
  EmailOpsSafetyCheck,
  EmailOpsSenderProfile,
  EmailOpsTestSendInput,
} from "../types"

export function resolveEmailOpsProviderStatus(): EmailOpsProviderStatus {
  const fromEmail = env.RESEND_FROM_EMAIL?.trim()
  const fromName = env.RESEND_FROM_NAME?.trim() || "Coach House"

  return {
    provider: "resend",
    configured: canSendResendEmail(),
    webhookConfigured: Boolean(env.RESEND_WEBHOOK_SECRET?.trim()),
    bulkSendEnabled: false,
    fromLabel: fromEmail
      ? `${fromName} <${fromEmail}>`
      : "No sender configured",
  }
}

export function buildEmailOpsSafetyChecks(
  providerStatus: EmailOpsProviderStatus
): EmailOpsSafetyCheck[] {
  return [
    {
      id: "resend-provider",
      label: "Resend provider",
      description: providerStatus.configured
        ? "API key is available for test delivery."
        : "Set RESEND_API_KEY before sending test emails.",
      state: providerStatus.configured ? "ready" : "blocked",
    },
    {
      id: "webhook-events",
      label: "Webhook events",
      description: providerStatus.webhookConfigured
        ? "Webhook secret is configured for event ingestion."
        : "Add RESEND_WEBHOOK_SECRET before relying on delivery analytics.",
      state: providerStatus.webhookConfigured ? "ready" : "warning",
    },
    {
      id: "bulk-send",
      label: "Bulk send lock",
      description:
        "Bulk sends stay disabled until suppression and approval workflows are live.",
      state: providerStatus.bulkSendEnabled ? "ready" : "warning",
    },
    {
      id: "unsubscribe-tokens",
      label: "Unsubscribe tokens",
      description: canCreateEmailPreferenceTokens()
        ? "Signed unsubscribe links can be generated for outbound email."
        : "Set EMAIL_OPS_TOKEN_SECRET before sending marketing email.",
      state: canCreateEmailPreferenceTokens() ? "ready" : "blocked",
    },
  ]
}

function parseResendFromLabel(fromLabel: string) {
  const match = fromLabel.match(/^(.*?)\s*<([^>]+)>$/)
  if (!match) {
    return {
      name: "Coach House",
      email: fromLabel.trim(),
    }
  }

  return {
    name: match[1]?.trim() || "Coach House",
    email: match[2]?.trim() || "",
  }
}

export function buildEmailOpsSenderProfiles(
  providerStatus: EmailOpsProviderStatus
): EmailOpsSenderProfile[] {
  const configuredEmail = env.RESEND_FROM_EMAIL?.trim()
  if (!configuredEmail) return []
  const configuredSender = parseResendFromLabel(providerStatus.fromLabel)

  const senderProfiles: EmailOpsSenderProfile[] = [
    {
      id: "configured-sender",
      name: env.RESEND_FROM_NAME?.trim() || configuredSender.name,
      email: configuredEmail,
      avatarUrl: null,
    },
  ]
  const seenEmails = new Set<string>()

  return senderProfiles.filter((profile) => {
    const normalizedEmail = profile.email.trim().toLowerCase()
    if (seenEmails.has(normalizedEmail)) return false
    seenEmails.add(normalizedEmail)
    return true
  })
}

export function buildEmailOpsHeatmap(): EmailOpsHeatmapPoint[] {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"]
  const hours = ["8a", "10a", "12p", "2p", "4p", "6p"]

  return days.flatMap((dayLabel, dayIndex) =>
    hours.map((hourLabel, hourIndex) => {
      const focusScore = Math.max(
        0,
        92 - Math.abs(dayIndex - 3) * 14 - Math.abs(hourIndex - 2) * 10
      )

      return {
        id: `${dayLabel}-${hourLabel}`,
        dayLabel,
        hourLabel,
        value: focusScore,
      }
    })
  )
}

export function buildEmailOpsDashboardInput(): EmailOpsDashboardInput {
  const providerStatus = resolveEmailOpsProviderStatus()

  return {
    id: "email-ops",
    selectedCampaignId: EMAIL_OPS_CAMPAIGNS[0].id,
    campaigns: EMAIL_OPS_CAMPAIGNS,
    segments: [
      {
        id: "internal-team",
        label: "Internal team",
        description: "Admins, coaches, and operators",
        count: 12,
      },
      {
        id: "coaches",
        label: "Coaches",
        description: "Coach-specific product notes",
        count: 18,
      },
      {
        id: "opted-in-members",
        label: "Opted-in members",
        description: "Members with newsletter or marketing consent",
        count: 148,
        lockedReason: "Bulk member sends are locked in v1.",
      },
    ],
    senderProfiles: buildEmailOpsSenderProfiles(providerStatus),
    safetyChecks: buildEmailOpsSafetyChecks(providerStatus),
    providerStatus,
    summaryMetrics: [
      { label: "Delivered", value: "2,418", delta: "+12% WoW" },
      { label: "Open rate", value: "64%", delta: "+6% WoW" },
      { label: "Click rate", value: "18%", delta: "+3% WoW" },
      { label: "Unsubscribes", value: "0.3%", delta: "-0.1% WoW" },
    ],
    metricTrend: [
      { label: "Week 1", sent: 420, opens: 238, clicks: 54 },
      { label: "Week 2", sent: 520, opens: 315, clicks: 82 },
      { label: "Week 3", sent: 610, opens: 392, clicks: 109 },
      { label: "Week 4", sent: 868, opens: 556, clicks: 156 },
    ],
    heatmap: buildEmailOpsHeatmap(),
  }
}

export function normalizeEmailOpsTestSendInput(
  input: EmailOpsTestSendInput
): EmailOpsTestSendInput {
  return {
    campaignId: input.campaignId.trim(),
    to: input.to.trim().toLowerCase(),
  }
}

export function buildEmailOpsNewDraftCampaign(): EmailOpsCampaign {
  return {
    id: "new",
    title: "Untitled email",
    subject: "Draft subject",
    previewText: "A new weekly update draft.",
    markdown: "# Untitled email\n\nHi team,\n\n",
    status: "draft",
    audienceSegmentId: "internal-team",
    ownerName: "Coach House",
    updatedAtLabel: "Unsaved",
    scheduledForLabel: null,
    heroMetric: "Draft",
    heroLabel: "not scheduled",
    tags: [],
  }
}

export function resolveEmailOpsDraftCampaign(campaignId: string) {
  if (campaignId === "new") return buildEmailOpsNewDraftCampaign()
  return findEmailOpsCampaign(campaignId)
}
