import sanitizeHtml from "sanitize-html"
import { stripHtml } from "@/lib/markdown/convert"

export type ApplicationInstructions = {
  state: "available" | "unsupported" | "unavailable"
  sourceUrl: string | null
  checkedAt: string
  acceptingProposals: "not_accepting" | "unknown"
  sections: { title: string; text: string; truncated: boolean }[]
}

/** A deliberately narrow adapter: arbitrary links and redirect destinations are never fetched. */
export function nsfSolicitationUrl(input: string): { url: string; publication: string } | null {
  try {
    const url = new URL(input)
    if (!["https:", "http:"].includes(url.protocol) || url.hostname !== "www.nsf.gov" || url.port || url.username || url.password) return null
    let publication: string | undefined
    if (url.pathname === "/publications/pub_summ.jsp" && [...url.searchParams.keys()].length === 1) {
      const match = /^nsf(\d{2})(\d{3})$/.exec(url.searchParams.get("ods_key") ?? "")
      if (match) publication = `${match[1]}-${match[2]}`
    } else if (!url.search) {
      publication = /^\/funding\/opportunities\/[a-z0-9-]+\/nsf(\d{2}-\d{3})\/solicitation\/?$/.exec(url.pathname)?.[1]
      const legacyRedirect = /^\/ods\/nsf(\d{2})(\d{3})$/.exec(url.pathname)
      if (legacyRedirect) publication = `${legacyRedirect[1]}-${legacyRedirect[2]}`
    }
    if (!publication) return null
    url.protocol = "https:"; url.hash = ""
    return { url: url.href, publication }
  } catch { return null }
}

/** Extract the numbered full instructions, never the shorter summary or navigation text.
 * External prose stays source data; it is neither an executable instruction nor proof of eligibility. */
export function parseNsfApplicationInstructions(html: string, sourceUrl: string, publication: string, checkedAt: string): ApplicationInstructions {
  const clean = sanitizeHtml(html, { allowedTags: ["h1", "h2", "h3", "h4", "p", "li", "br"], allowedAttributes: {}, nonTextTags: ["script", "style", "textarea", "option", "noscript", "template"] })
  const headingText = (value: string) => stripHtml(value).replace(/\s+/g, " ").trim()
  const title = /<h1>([\s\S]*?)<\/h1>/.exec(clean)?.[1]
  if (!title || !headingText(title).startsWith(`NSF ${publication}:`)) throw new Error("Official solicitation identity could not be verified.")
  const unavailable: ApplicationInstructions = { state: "unavailable", sourceUrl, checkedAt, acceptingProposals: "unknown", sections: [] }
  if ([...clean.matchAll(/<h2>([\s\S]*?)<\/h2>/g)].some(match => /^Not currently accepting proposals$/i.test(headingText(match[1])))) unavailable.acceptingProposals = "not_accepting"
  const headings = [...clean.matchAll(/<h3>([\s\S]*?)<\/h3>/g)]
  const index = headings.findIndex(match => /^V\.\s+Proposal Preparation And Submission Instructions$/i.test(headingText(match[1])))
  if (index < 0 || !headings[index + 1]) return unavailable
  const body = clean.slice(headings[index].index! + headings[index][0].length, headings[index + 1].index)
  const parts = [...body.matchAll(/<h4>([\s\S]*?)<\/h4>/g)]
  if (parts.length === 0 || parts.length > 12) return unavailable
  let remaining = 30000
  const sections = parts.map((part, i) => {
    const title = headingText(part[1]).slice(0, 200)
    const text = stripHtml(body.slice(part.index! + part[0].length, parts[i + 1]?.index)).trim()
    const limit = Math.min(10000, remaining), bounded = text.slice(0, limit)
    remaining -= bounded.length
    return { title, text: bounded, truncated: text.length > bounded.length }
  }).filter(section => section.text.length > 0)
  if (!sections.length || remaining === 0) return unavailable
  return { ...unavailable, state: "available", sections }
}
