import "server-only"
import { randomUUID } from "node:crypto"
import type { KnowledgeRecord } from "../research-types"
import type { ResearchContext } from "./research-context"
import type { createKnowledgeFreshness } from "./knowledge-freshness"
import { knowledgeLoader, type UploadedKnowledgePosition } from "./knowledge-records"
import { rankUploadedDocumentCandidates, searchUploadedDocumentKnowledge } from "./knowledge-document-search"

type Discovery = {
  binding: string; phase: "title_matches" | "library"; after?: UploadedKnowledgePosition
  pending: KnowledgeRecord[]; candidates: number; read: number; seen: Set<string>
  next: UploadedKnowledgePosition | null; loaded: boolean; unreadPriorPages: number
}

/** Run-local navigation only, never an authority or a persistent library index.
 * Tokens are single-use and bound to the exact search. Every page and pending
 * source goes through the current canonical readers before content disclosure. */
export function createUploadedDiscovery(freshness: ReturnType<typeof createKnowledgeFreshness>, signal?: AbortSignal) {
  const continuations = new Map<string, { state: Discovery; advance: boolean }>()
  return async (context: ResearchContext, query: string, binding: string, cursor?: string | null) => {
    const load = knowledgeLoader(context)
    const saved = cursor ? continuations.get(cursor) : undefined
    const state: Discovery | undefined = cursor ? saved?.state : {
      binding, phase: "title_matches", pending: [], candidates: 0, read: 0, seen: new Set(), next: null, loaded: false, unreadPriorPages: 0,
    }
    if (!state || state.binding !== binding) throw new Error("Search continuation is unavailable. Restart search.")
    // Consume both sibling choices before awaiting work; neither can replay a
    // mutated state or race another continuation of the same page.
    for (const [token,value] of continuations) if (value.state === state) continuations.delete(token)
    if (saved?.advance) state.pending = []
    if (!state.pending.length) {
      if (state.loaded) {
        state.unreadPriorPages += state.candidates - state.read
        if (state.next) state.after = state.next
        else { state.phase = "library"; state.after = undefined }
      }
      const fetchPage = async () => {
        state.next = null
        const records = await load("document", state.phase === "title_matches" ? query : "", undefined,
          { after: state.after, next: position => { state.next = position } })
        signal?.throwIfAborted()
        state.pending = records.filter(record => record.id.startsWith("file:") && !state.seen.has(record.id)).slice(0,20)
        state.candidates = state.pending.length; state.read = 0; state.loaded = true
        for (const record of state.pending) state.seen.add(record.id)
      }
      await fetchPage()
      // An empty title page has used no candidate budget. Start the library
      // immediately only at the end of that stream, including hidden-only pages.
      if (!state.pending.length && !state.next && state.phase === "title_matches") {
        state.phase = "library"; state.after = undefined
        await fetchPage()
      }
    }
    // Pending metadata is also private: recheck every disclosed candidate, not
    // just the five whose contents will be extracted on this call.
    const metadata: KnowledgeRecord[] = []
    for (let index = 0; index < state.pending.length; index += 4)
      metadata.push(...await Promise.all(state.pending.slice(index,index+4).map(record => freshness.read(load,record))))
    const eligible = rankUploadedDocumentCandidates(metadata,query)
    const selected = eligible.slice(0,5)
    let read = 0
    const hits = await searchUploadedDocumentKnowledge(context,selected,query,freshness,signal,() => { read++ })
    // No-hit batches still require current scope before issuing continuation.
    await freshness.context()
    state.pending = eligible.slice(5); state.read += read
    if (state.seen.size > 160) throw new Error("Search continuation budget exhausted.")
    const more = state.pending.length > 0 || state.next !== null || state.phase === "title_matches"
    const continuation = more ? randomUUID() : null
    const hasNextPage = state.next !== null || state.phase === "title_matches"
    const nextPage = hasNextPage ? state.pending.length ? randomUUID() : continuation : null
    if (continuation) {
      if (continuations.size >= 16) throw new Error("Search continuation budget exhausted.")
      continuations.set(continuation, {state,advance:false})
      if (nextPage && nextPage !== continuation) continuations.set(nextPage, {state,advance:true})
    }
    return { hits, metadata, coverage: { scope: state.phase, candidates: state.candidates,
      attempted: selected.length, read, unread: state.candidates - state.read, pending: state.pending.length,
      unreadPriorPages: state.unreadPriorPages, continuation, nextPage } }
  }
}
