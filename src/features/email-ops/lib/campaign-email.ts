import type { EmailOpsCampaign } from "../types"
import { renderEmailOpsMarkdownHtml, renderEmailOpsMarkdownText } from "./campaign-content"

function escape(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;")
}

/** Authored campaign content stays intact; delivery still runs the shared content audit. */
export function buildEmailOpsCampaignEmail(campaign: Pick<EmailOpsCampaign, "subject" | "previewText" | "markdown">, siteUrl = "https://coachhouse.app") {
  const logoUrl = `${siteUrl.replace(/\/+$/, "")}/coach-house-logo-dark.png`
  const content = renderEmailOpsMarkdownHtml(campaign.markdown)
  const html = `<!doctype html><html lang="en"><body style="margin:0;padding:0;background:#ffffff;color:#19202a;font-family:Arial,Helvetica,sans-serif;line-height:1.6;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escape(campaign.previewText)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;"><tr><td align="center" style="padding:32px 20px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;"><tr><td style="padding:0 0 32px;"><img src="${escape(logoUrl)}" alt="Coach House" width="120" height="120" style="display:block;width:120px;height:120px;border:0;"></td></tr><tr><td style="font-size:15px;line-height:25px;">${content}</td></tr></table>
</td></tr></table></body></html>`
  return { subject: campaign.subject, html, text: renderEmailOpsMarkdownText(campaign.markdown) }
}
