import {
  MINIMAL_EMAIL_CHARSET_META,
  MINIMAL_EMAIL_RESPONSIVE_STYLE,
  MINIMAL_EMAIL_VIEWPORT_META,
} from "./minimal-template"

export type EmailContentAuditIssueSeverity = "blocked" | "warning"

export type EmailContentAuditIssue = {
  id: string
  severity: EmailContentAuditIssueSeverity
  message: string
}

export type EmailContentAuditInput = {
  subject: string
  html: string
  text: string
  previewText?: string | null
  unsubscribeUrl?: string | null
}

export type EmailContentAuditResult = {
  sanitizedHtml: string
  issues: EmailContentAuditIssue[]
  blocked: boolean
}

const BLOCKLISTED_TAG_PATTERN =
  /<\s*(script|iframe|object|embed|link|meta|base|form|input|button)\b/gi
const BLOCKLISTED_TAG_WITH_BODY_PATTERN =
  /<\s*(script|iframe|object|embed)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi
const BLOCKLISTED_SELF_CLOSING_TAG_PATTERN =
  /<\s*(script|iframe|object|embed|link|meta|base|form|input|button)\b[^>]*\/?>/gi
const STYLE_TAG_PATTERN = /<\s*style\b[^>]*>[\s\S]*?(?:<\s*\/\s*style\s*>|$)/gi
const SAFE_META_TAGS = new Set([MINIMAL_EMAIL_CHARSET_META, MINIMAL_EMAIL_VIEWPORT_META])
const EVENT_HANDLER_PATTERN = /\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi
const DANGEROUS_PROTOCOL_PATTERN = /\b(?:href|src)\s*=\s*(["']?)\s*(javascript:|data:text\/html)/gi
const HTML_LINK_PATTERN = /<a\b[^>]*\bhref\s*=\s*(["'])(.*?)\1[^>]*>/gi
const IMAGE_PATTERN = /<img\b[^>]*>/gi
const IMAGE_ALT_PATTERN = /\salt\s*=/i
const UNSUBSCRIBE_LINK_PATTERN = /unsubscribe/i

function stripDangerousEmailHtml(input: string) {
  return input
    .replace(BLOCKLISTED_TAG_WITH_BODY_PATTERN, "")
    .replace(STYLE_TAG_PATTERN, (tag) => tag === MINIMAL_EMAIL_RESPONSIVE_STYLE ? tag : "")
    .replace(BLOCKLISTED_SELF_CLOSING_TAG_PATTERN, (tag) => SAFE_META_TAGS.has(tag) ? tag : "")
    .replace(EVENT_HANDLER_PATTERN, "")
    .replace(DANGEROUS_PROTOCOL_PATTERN, "href=$1#blocked-")
}

function countMatches(pattern: RegExp, input: string) {
  return Array.from(input.matchAll(pattern)).length
}

function hasMatch(pattern: RegExp, input: string) {
  pattern.lastIndex = 0
  return pattern.test(input)
}

function collectLinkWarnings(html: string): EmailContentAuditIssue[] {
  const issues: EmailContentAuditIssue[] = []
  const links = Array.from(html.matchAll(HTML_LINK_PATTERN))

  for (const [, , href] of links) {
    const normalizedHref = href.trim().toLowerCase()
    if (
      normalizedHref.startsWith("http://") ||
      normalizedHref.startsWith("https://") ||
      normalizedHref.startsWith("mailto:")
    ) {
      continue
    }

    issues.push({
      id: "unsafe-link-protocol",
      severity: "warning",
      message: "Email links should use https or mailto URLs before sending.",
    })
    break
  }

  return issues
}

export function auditEmailContentForDelivery(
  input: EmailContentAuditInput
): EmailContentAuditResult {
  const issues: EmailContentAuditIssue[] = []
  const subject = input.subject.trim()
  const text = input.text.trim()
  const html = input.html || ""
  const sanitizedHtml = stripDangerousEmailHtml(html)

  if (!subject) {
    issues.push({
      id: "missing-subject",
      severity: "blocked",
      message: "Email subject is required.",
    })
  } else if (subject.length > 78) {
    issues.push({
      id: "long-subject",
      severity: "warning",
      message: "Subject is long; keep it tighter for inbox scanning.",
    })
  }

  if (!text) {
    issues.push({
      id: "missing-plain-text",
      severity: "warning",
      message: "Plain-text fallback is missing.",
    })
  }

  // Exact renderer metadata is inert; authored variants still face the original blocklist.
  const htmlWithoutSafeMeta = html.replaceAll(MINIMAL_EMAIL_CHARSET_META, "").replaceAll(MINIMAL_EMAIL_VIEWPORT_META, "")
  if (hasMatch(BLOCKLISTED_TAG_PATTERN, htmlWithoutSafeMeta) || hasMatch(EVENT_HANDLER_PATTERN, html)) {
    issues.push({
      id: "dangerous-html",
      severity: "blocked",
      message: "Email HTML contains blocked tags or event handlers.",
    })
  }

  if (hasMatch(DANGEROUS_PROTOCOL_PATTERN, html)) {
    issues.push({
      id: "dangerous-url",
      severity: "blocked",
      message: "Email HTML contains javascript or HTML data URLs.",
    })
  }

  issues.push(...collectLinkWarnings(sanitizedHtml))

  const imageCount = countMatches(IMAGE_PATTERN, sanitizedHtml)
  const imagesWithAlt = Array.from(sanitizedHtml.matchAll(IMAGE_PATTERN)).filter(
    ([image]) => IMAGE_ALT_PATTERN.test(image)
  ).length
  if (imageCount > imagesWithAlt) {
    issues.push({
      id: "image-alt-text",
      severity: "warning",
      message: "Every email image should include useful alt text.",
    })
  }

  if (!UNSUBSCRIBE_LINK_PATTERN.test(sanitizedHtml) && !input.unsubscribeUrl) {
    issues.push({
      id: "missing-unsubscribe",
      severity: "warning",
      message: "Marketing emails need a visible unsubscribe or preference link.",
    })
  }

  if (input.previewText && input.previewText.trim().length > 150) {
    issues.push({
      id: "long-preview-text",
      severity: "warning",
      message: "Preview text is long; keep it short enough for inbox previews.",
    })
  }

  return {
    sanitizedHtml,
    issues,
    blocked: issues.some((issue) => issue.severity === "blocked"),
  }
}
