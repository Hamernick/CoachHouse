import { fetchPublicPreviewHtml } from "@/lib/people/linkedin-image-refresh"
import { decodeHtmlEntities } from "@/lib/markdown/convert"

export function parsePublicPageMetadata(html: string) {
  const metadata = new Map<string, string>()
  for (const tag of html.match(/<meta\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi) ?? []) {
    const attributes = new Map([...tag.matchAll(/([\w:-]+)\s*=\s*(["'])([\s\S]*?)\2/gi)].map(match => [match[1].toLowerCase(), match[3]]))
    const name = attributes.get("property") ?? attributes.get("name")
    const content = attributes.get("content")
    if (name && content) metadata.set(name.toLowerCase(), content)
  }
  const clean = (text: string | undefined, length: number) => text ? decodeHtmlEntities(text.replace(/<[^>]*>/g, "")).trim().slice(0, length) : undefined
  return {
    title: clean(metadata.get("og:title") ?? html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1], 240),
    description: clean(metadata.get("og:description") ?? metadata.get("description"), 500),
    siteName: clean(metadata.get("og:site_name"), 120),
  }
}
export async function fetchPublicPageMetadata(url: string) {
  return parsePublicPageMetadata(await fetchPublicPreviewHtml(url))
}
