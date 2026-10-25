import type { Metadata } from "next"
import { notFound } from "next/navigation"

import {
  buildEmailOpsDashboardInput,
  EmailOpsDraftEditor,
  renderEmailOpsMarkdownHtml,
  resolveEmailOpsDraftCampaign,
  sendEmailOpsTestEmailAction,
  type EmailOpsDraftEditorMode,
} from "@/features/email-ops"
import { requireAdmin } from "@/lib/admin/auth"

export const metadata: Metadata = {
  title: "Email Draft",
  description: "Review and edit a Coach House email campaign draft.",
}


type EmailDraftPageProps = {
  params: Promise<{ campaignId: string }>
  searchParams?: Promise<{ mode?: string }>
}

export default async function EmailDraftPage({
  params,
  searchParams,
}: EmailDraftPageProps) {
  await requireAdmin()

  const { campaignId } = await params
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const campaign = resolveEmailOpsDraftCampaign(campaignId)
  const initialMode: EmailOpsDraftEditorMode =
    resolvedSearchParams?.mode === "send" ? "send" : "draft"

  if (!campaign) {
    notFound()
  }

  return (
    <EmailOpsDraftEditor
      campaign={campaign}
      input={buildEmailOpsDashboardInput()}
      initialBodyHtml={renderEmailOpsMarkdownHtml(campaign.markdown)}
      initialMode={initialMode}
      testSendAction={sendEmailOpsTestEmailAction}
    />
  )
}
