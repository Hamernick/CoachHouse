import { describe, expect, it, vi } from "vitest"
import { nsfSolicitationUrl, parseNsfApplicationInstructions } from "@/features/workspace-finance/lib/application-instructions"
import { fetchApplicationInstructions } from "@/features/workspace-finance/server/application-instructions"
import { opportunityApplicationSeed } from "@/features/workspace-finance/lib/opportunity-application"
import { normalizeGrantsGovDetail } from "@/features/workspace-finance/lib/grants-gov-detail"
import { notice, now } from "./fixtures/opportunity-match-fixtures"

const legacy = "http://www.nsf.gov/publications/pub_summ.jsp?ods_key=nsf23589"
const canonical = "https://www.nsf.gov/funding/opportunities/circ-community/nsf23-589/solicitation"
const html = (text = "Describe your project. Limit: 15 pages.") => `<h1>NSF 23-589: Test solicitation</h1><h3>Summary</h3><h4>Proposal Preparation</h4><p>Summary only</p><h3>V. Proposal Preparation And Submission Instructions</h3><h4>A. Proposal Preparation Instructions</h4><p>${text}</p><h4>B. Budgetary Information</h4><p>Cost sharing is prohibited.</p><h3>VI. Review Procedures</h3><p>Not preparation instructions</p>`
const response = (body = html()) => new Response(body, { headers: { "content-type": "text/html; charset=utf-8" } })

describe("bounded official application instructions", () => {
  it("follows only same-publication NSF redirects and sends no private context", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(null, { status: 301, headers: { location: "/ods/nsf23589" } })).mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: canonical } })).mockResolvedValueOnce(response())
    const result = await fetchApplicationInstructions(legacy, fetchImpl, now)
    expect(result).toMatchObject({ state: "available", sourceUrl: canonical, checkedAt: now, acceptingProposals: "unknown" })
    expect(result.sections).toEqual([{ title: "A. Proposal Preparation Instructions", text: "Describe your project. Limit: 15 pages.", truncated: false }, { title: "B. Budgetary Information", text: "Cost sharing is prohibited.", truncated: false }])
    expect(fetchImpl.mock.calls[0][0]).toBe(legacy.replace("http:", "https:"))
    for (const [, options] of fetchImpl.mock.calls) expect(options).toMatchObject({ method: "GET", redirect: "manual", credentials: "omit", headers: { Accept: "text/html" } })
    expect(JSON.stringify(fetchImpl.mock.calls)).not.toContain("Authorization")
    const seed = opportunityApplicationSeed(notice(), result)
    expect(seed.content).toContain("Official preparation instructions")
    expect(seed.content).toContain("15 pages.")
    expect(seed.content).not.toContain("Summary only")
    expect(seed.content).not.toContain("Not preparation instructions")
  })
  it.each(["https://127.0.0.1/", "https://www.nsf.gov.evil.test/publications/pub_summ.jsp?ods_key=nsf23589", "https://user:pass@www.nsf.gov/publications/pub_summ.jsp?ods_key=nsf23589", "https://www.nsf.gov:8443/publications/pub_summ.jsp?ods_key=nsf23589", "file:///tmp/a", "https://www.nsf.gov/publications/pub_summ.jsp?ods_key=nsf23589&url=http://127.0.0.1/"])("does not fetch unsupported URL %s", async source => {
    const fetchImpl = vi.fn<typeof fetch>()
    expect(nsfSolicitationUrl(source)).toBeNull()
    expect((await fetchApplicationInstructions(source, fetchImpl, now)).state).toBe("unsupported")
    expect(fetchImpl).not.toHaveBeenCalled()
  })
  it.each(["https://127.0.0.1/private", "https://other.nsf.gov/private", "https://www.nsf.gov/funding/opportunities/other/nsf24-123/solicitation"])("rejects redirect outside exact adapter identity: %s", async location => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 302, headers: { location } }))
    expect((await fetchApplicationInstructions(legacy, fetchImpl, now)).state).toBe("unavailable")
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
  it("caps redirect chains and rejects wrong identity, missing full sections, MIME and oversized streamed bodies", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () => new Response(null, { status: 302, headers: { location: canonical } }))
    expect((await fetchApplicationInstructions(legacy, fetchImpl, now)).state).toBe("unavailable")
    expect(fetchImpl).toHaveBeenCalledTimes(4)
    for (const item of [response(html().replace("NSF 23-589:", "NSF 24-123:")), response("<h1>NSF 23-589: Missing</h1>"), new Response("PDF", { headers: { "content-type": "application/pdf" } }), response("x".repeat(1024 * 1024 + 1))]) {
      expect((await fetchApplicationInstructions(legacy, async () => item, now)).state).toBe("unavailable")
    }
    expect((await fetchApplicationInstructions(legacy, async () => { throw new Error("timeout") }, now)).state).toBe("unavailable")
  })
  it("detects the official not-accepting alert without claiming an absent alert proves availability", () => {
    const parsed = parseNsfApplicationInstructions(`<h2>Not currently accepting proposals</h2>${html()}`, canonical, "23-589", now)
    expect(parsed.acceptingProposals).toBe("not_accepting")
    expect(parseNsfApplicationInstructions(html(), canonical, "23-589", now).acceptingProposals).toBe("unknown")
  })
  it("removes executable/hidden content, escapes output and explicitly marks bounded excerpts", () => {
    const parsed = parseNsfApplicationInstructions(html('<script>secret instruction</script><style>hidden css</style><template>hidden template</template>Include &lt;em&gt;literal&lt;/em&gt; text. ' + "x".repeat(11000)), canonical, "23-589", now)
    expect(parsed.sections[0].text).not.toMatch(/secret instruction|hidden css|hidden template/)
    expect(parsed.sections[0].text).toHaveLength(10000)
    expect(parsed.sections[0].truncated).toBe(true)
    const seed = opportunityApplicationSeed(notice(), parsed)
    expect(seed.content).toContain("&lt;em&gt;literal&lt;/em&gt;")
    expect(seed.content).toContain("[Excerpt: read the complete official section.]")
  })
  it("records the original funder link from the official detail with field evidence, ignoring unsafe schemes", () => {
    const raw = { errorcode: 0, data: { id: 123, opportunityTitle: "Test", docType: "synopsis", synopsis: { opportunityId: 123, fundingDescLinkUrl: legacy } } }
    const value = normalizeGrantsGovDetail(raw, "123", now)
    expect(value.applicationSourceUrl).toBe(legacy)
    expect(value.evidence).toContainEqual(expect.objectContaining({ field: "applicationSourceUrl", path: "data.synopsis.fundingDescLinkUrl" }))
    raw.data.synopsis.fundingDescLinkUrl = "javascript:alert(1)"
    expect(normalizeGrantsGovDetail(raw, "123", now).applicationSourceUrl).toBeNull()
  })
})
