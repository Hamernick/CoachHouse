import { markdownToHtmlLite } from "@/lib/markdown/simple"
export const EMAIL_OPS_HTML_DRAFT_MARKER = "<!-- email-ops-html-draft -->"

export function renderEmailOpsMarkdownHtml(markdown: string) {
  const trimmed = markdown.trim()
  if (trimmed.startsWith(EMAIL_OPS_HTML_DRAFT_MARKER)) {
    return trimmed.replace(EMAIL_OPS_HTML_DRAFT_MARKER, "").trim()
  }

  return markdownToHtmlLite(markdown)
}

export function renderEmailOpsMarkdownText(markdown: string) {
  const trimmed = markdown.trim()
  if (trimmed.startsWith(EMAIL_OPS_HTML_DRAFT_MARKER)) {
    return trimmed
      .replace(EMAIL_OPS_HTML_DRAFT_MARKER, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|h1|h2|h3|li)>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  }

  return markdown
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/^- /gm, "- ")
    .trim()
}
