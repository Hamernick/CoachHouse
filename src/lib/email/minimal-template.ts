export type MinimalEmailDetail = { label: string; value: string }
export type MinimalEmailLink = { label: string; href: string }
export type MinimalEmailInput = {
  siteUrl?: string
  logoUrl?: string
  eyebrow?: string
  title: string
  intro?: string
  body?: string[]
  details?: MinimalEmailDetail[]
  sections?: { title: string; body?: string[]; details?: MinimalEmailDetail[] }[]
  action?: MinimalEmailLink
  links?: MinimalEmailLink[]
  helpText?: string
  footer?: string
  previewText?: string
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;")
}

function safeUrl(value: string, allowAuthPlaceholder = false) {
  if (allowAuthPlaceholder && /^{{\s*\.ConfirmationURL\s*}}$/.test(value)) return value
  if (!/^https?:\/\//i.test(value) || /[\u0000-\u0020\u007f]/.test(value.replace(/{{\s*\.(?:TokenHash|RedirectTo)\s*}}/g, "token"))) {
    throw new Error("Email links must use an absolute HTTP(S) URL")
  }
  return value
}

// Delivery audit permits only these fixed, non-interactive head fragments.
export const MINIMAL_EMAIL_CHARSET_META = '<meta charset="utf-8">'
export const MINIMAL_EMAIL_VIEWPORT_META = '<meta name="viewport" content="width=device-width, initial-scale=1">'
export const MINIMAL_EMAIL_RESPONSIVE_STYLE = '<style>@media only screen and (max-width:480px){.email-content{padding:20px 16px!important}.email-label{width:38%!important;padding-right:12px!important}.email-action{padding:12px 16px!important}}</style>'

const paragraphStyle = "margin:0 0 8px;font-size:14px;line-height:21px;color:#252525;overflow-wrap:anywhere;word-break:break-word;"
const renderParagraph = (text: string) => `<p style="${paragraphStyle}">${escapeHtml(text).replaceAll("\n", "<br>")}</p>`
const renderDetails = (details: MinimalEmailDetail[] = []) => details.length ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:4px 0 12px;">${details.map(({ label, value }) => `<tr><td class="email-label" style="width:34%;padding:4px 16px 4px 0;vertical-align:top;font-size:12px;line-height:19px;color:#626262;">${escapeHtml(label)}</td><td class="email-value" style="padding:4px 0;vertical-align:top;font-size:13px;line-height:19px;font-weight:500;color:#252525;overflow-wrap:anywhere;word-break:break-word;">${escapeHtml(value).replaceAll("\n", "<br>")}</td></tr>`).join("")}</table>` : ""

/** Presentation only: callers retain recipient, authorization and delivery ownership. */
export function renderMinimalEmail(input: MinimalEmailInput): { html: string; text: string } {
  const logoUrl = safeUrl(input.logoUrl ?? `${(input.siteUrl ?? "https://coachhouse.app").replace(/\/$/, "")}/coach-house-logo-dark.png`)
  const actionUrl = input.action ? safeUrl(input.action.href, true) : null
  const links = (input.links ?? []).map((link) => ({ ...link, href: safeUrl(link.href, true) }))
  const detailsText = (details: MinimalEmailDetail[] = []) => details.map(({ label, value }) => `${label}: ${value}`).join("\n")
  const text = ["Coach House", input.eyebrow, input.title, input.intro, ...(input.body ?? []), detailsText(input.details),
    ...(input.sections ?? []).map((section) => [section.title, ...(section.body ?? []), detailsText(section.details)].filter(Boolean).join("\n\n")),
    input.action ? `${input.action.label}: ${actionUrl}` : "", ...links.map(({ label, href }) => `${label}: ${href}`), input.helpText, input.footer,
  ].filter(Boolean).join("\n\n")
  const html = `<!doctype html>
<html lang="en"><head>${MINIMAL_EMAIL_CHARSET_META}${MINIMAL_EMAIL_VIEWPORT_META}<title>${escapeHtml(input.title)}</title>
${MINIMAL_EMAIL_RESPONSIVE_STYLE}</head>
<body style="margin:0;padding:0;background:#ffffff;color:#252525;font-family:Arial,Helvetica,sans-serif;">
${input.previewText ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${escapeHtml(input.previewText)}</div>` : ""}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#ffffff"><tr><td align="center">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background:#ffffff;"><tr><td class="email-content" align="left" style="padding:24px 28px;text-align:left;">
<img src="${escapeHtml(logoUrl)}" alt="Coach House" width="36" height="36" style="display:block;width:36px;height:36px;border:0;margin:0 0 14px;">
${input.eyebrow ? `<p style="margin:0 0 4px;font-size:12px;line-height:18px;color:#626262;">${escapeHtml(input.eyebrow)}</p>` : ""}
<h1 style="margin:0 0 8px;font-size:22px;line-height:28px;font-weight:600;color:#171717;overflow-wrap:anywhere;word-break:break-word;">${escapeHtml(input.title)}</h1>
${input.intro ? renderParagraph(input.intro) : ""}${(input.body ?? []).map(renderParagraph).join("")}${renderDetails(input.details)}
${(input.sections ?? []).map((section) => `<h2 style="margin:16px 0 4px;font-size:13px;line-height:18px;font-weight:600;color:#171717;">${escapeHtml(section.title)}</h2>${(section.body ?? []).map(renderParagraph).join("")}${renderDetails(section.details)}`).join("")}
${input.action ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:16px 0 8px;"><tr><td bgcolor="#171717" style="background:#171717;border-radius:999px;"><a class="email-action" href="${escapeHtml(actionUrl!)}" style="display:inline-block;padding:8px 14px;border:1px solid #171717;border-radius:999px;background:#171717;color:#ffffff;font-size:13px;line-height:18px;font-weight:600;text-decoration:none;">${escapeHtml(input.action.label)}</a></td></tr></table>` : ""}
${links.length ? `<p style="margin:12px 0;font-size:13px;line-height:20px;">${links.map(({ label, href }) => `<a href="${escapeHtml(href)}" style="color:#252525;text-decoration:underline;">${escapeHtml(label)}</a>`).join("<br>")}</p>` : ""}
${input.helpText ? `<p style="margin:8px 0 0;font-size:12px;line-height:18px;color:#626262;">${escapeHtml(input.helpText)}</p>` : ""}
${input.footer ? `<p style="margin:16px 0 0;padding-top:12px;border-top:1px solid #e5e5e5;font-size:12px;line-height:18px;color:#626262;">${escapeHtml(input.footer)}</p>` : ""}
</td></tr></table></td></tr></table></body></html>`
  return { html, text }
}
