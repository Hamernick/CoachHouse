import "server-only"
import { z } from "zod"
import { buildGrantsGovSearchRequest, GRANTS_GOV_SEARCH_ENDPOINT, mapGrantsGovSearchResponse } from "../lib/grants-gov"
import { GRANTS_GOV_DETAIL_ENDPOINT, normalizeGrantsGovDetail } from "../lib/grants-gov-detail"
import type { OfficialOpportunityNotice } from "../matching-types"

const MAX_BYTES = 512 * 1024
export async function fetchOfficialOpportunity(externalId:string, fetchImpl:typeof fetch=fetch, observedAt=new Date().toISOString()) {
  if (!/^\d{1,12}$/.test(externalId)) throw new Error("Invalid opportunity ID.")
  return normalizeGrantsGovDetail(await postOfficial(GRANTS_GOV_DETAIL_ENDPOINT,{opportunityId:Number(externalId)},fetchImpl,AbortSignal.timeout(10000)),externalId,observedAt)
}
async function postOfficial(endpoint: string, body: unknown, fetchImpl: typeof fetch, signal: AbortSignal) {
  const response = await fetchImpl(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store", redirect: "error", signal })
  if (!response.ok) throw new Error("The official opportunity source is unavailable.")
  if (Number(response.headers.get("content-length")) > MAX_BYTES) throw new Error("Official response exceeds the size limit.")
  const reader = response.body?.getReader()
  if (!reader) throw new Error("Official response is empty.")
  const decoder = new TextDecoder(), chunks: string[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_BYTES) { await reader.cancel(); throw new Error("Official response exceeds the size limit.") }
      chunks.push(decoder.decode(value, { stream: true }))
    }
  } finally { reader.releaseLock() }
  return JSON.parse(chunks.join("") + decoder.decode()) as unknown
}

/** On-demand public discovery reuses the registered Grants.gov search adapter; no DB writes. */
export async function discoverOfficialOpportunities({ keyword, limit = 3, fetchImpl = fetch, observedAt = new Date().toISOString() }: {
  keyword: string; limit?: number; fetchImpl?: typeof fetch; observedAt?: string;
}) {
  z.number().int().min(1).max(5).parse(limit)
  z.iso.datetime().parse(observedAt)
  const request = buildGrantsGovSearchRequest({ keyword, rows: limit })
  if (!request) throw new Error("The Grants.gov search is invalid.")
  const signal = AbortSignal.timeout(15_000)
  const search = mapGrantsGovSearchResponse(await postOfficial(GRANTS_GOV_SEARCH_ENDPOINT, request, fetchImpl, signal))
  if (!search || search.length > limit) throw new Error("The official search response is invalid.")
  const ids = [...new Set(search.map(item => item.externalId).filter((id): id is string => typeof id === "string" && /^\d{1,12}$/.test(id)))]
  const results = await Promise.allSettled(ids.map(async id => normalizeGrantsGovDetail(await postOfficial(GRANTS_GOV_DETAIL_ENDPOINT, { opportunityId: Number(id) }, fetchImpl, signal), id, observedAt)))
  const notices: OfficialOpportunityNotice[] = []
  let rejected = search.length - ids.length, unavailable = 0
  for (const result of results) {
    if (result.status === "rejected") { unavailable++; continue }
    const notice = result.value
    // A date-only deadline has no promised cutoff time. Exclude it only after that date ended worldwide.
    const expired = notice.deadlineDate !== null && Date.parse(`${notice.deadlineDate}T00:00:00Z`) + 36 * 60 * 60 * 1000 < Date.parse(observedAt)
    if (!["posted", "forecasted"].includes(notice.status) || expired) rejected++
    else notices.push(notice)
  }
  return { provider: "grants_gov" as const, observedAt, notices, checked: ids.length, rejected, unavailable }
}
