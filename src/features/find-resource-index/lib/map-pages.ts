import { loadFindResourceQuery } from "./client-cache"

// Keep individual responses bounded while loading every eligible pin in the viewport.
export async function loadResourceMapPages(url: string, revalidate = false, isCurrent = () => true) {
  let page = await loadFindResourceQuery(url, revalidate)
  const revision = page.revision
  const items = new Map(page.resourceItems.map((item) => [item.id, item]))
  const seen = new Set<string>()
  while (page.page.hasMore) {
    if (!isCurrent()) throw new Error("Map query superseded")
    const cursor = page.page.nextCursor
    if (!cursor || seen.has(cursor)) throw new Error("Map cursor did not advance")
    seen.add(cursor)
    const nextUrl = new URL(url, "https://coachhouse.app")
    nextUrl.searchParams.set("cursor", cursor)
    page = await loadFindResourceQuery(nextUrl.pathname + nextUrl.search, revalidate)
    if (page.revision !== revision) throw new Error("Map catalog changed; retry the current viewport")
    for (const item of page.resourceItems) items.set(item.id, item)
  }
  return { ...page, resourceItems: [...items.values()] }
}
