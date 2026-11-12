import { execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  IRS_EO_SERVICE_EVIDENCE_VERSION,
  collectIrsEoServiceEvidence,
  extractIrsEoServiceFieldEvidence,
  isProviderLinkedServicePage,
} from "../../scripts/resource-map/lib/irs-eo-service-evidence.mjs"
import type { fetchProviderPageSnapshot } from "../../scripts/resource-map/lib/provider-page-comparison.mjs"

type FetchedPageSnapshot = Extract<
  Awaited<ReturnType<typeof fetchProviderPageSnapshot>>,
  { contentHash: string }
>

const ROOT = process.cwd()
const COLLECTOR = join(
  ROOT,
  "scripts/resource-map/collect-irs-eo-service-evidence.mjs"
)

function pageSnapshot(url: string): FetchedPageSnapshot {
  const textExcerpt =
    "We provide free family support in Durham County. Open Monday through Friday, 9:00 AM to 5:00 PM. Open to Durham County residents age 18 and older. Register online or call (919) 555-0100 for an appointment."
  return {
    checkedAt: "2026-08-31T12:00:00.000Z",
    contentHash: "service-page-content-hash",
    contentType: "text/html",
    evidenceSnippet: textExcerpt,
    fetchStatus: "fetched",
    finalUrl: url,
    httpStatus: 200,
    pageTitle: "Family Support Program",
    pageEvidence: {
      contentSha256: "service-page-content-hash",
      contentType: "text/html",
      evidenceUrl: url,
      metaDescription: null,
      pageTitle: "Family Support Program",
      headings: ["Get support"],
      textExcerpt,
      truncated: false,
    },
    pageSignals: {
      schemaVersion: 1,
      contacts: [],
      socialAccounts: [],
      evidenceLinkCandidates: [],
      imageCandidates: [],
    },
    visibleText: textExcerpt,
    websiteUrl: url,
  }
}

function researchResult(url: string) {
  return {
    ein: "123456789",
    acquisitionStatus: "website_matched",
    websiteUrl: "https://provider.example.org/",
    evidenceUrls: ["https://provider.example.org/"],
    providerIdentitySupported: true,
    providerLinkedEvidencePages: [
      { url, providerLinked: true, sourceUrl: "https://provider.example.org/" },
      { url: "https://unrelated.example.net/help", providerLinked: true },
    ],
    socialAccounts: [],
    services: [],
    serviceAreas: [],
    publicDisplayEligible: false,
    publicationBlocked: true,
  }
}

function readJsonl(filePath: string) {
  const body = readFileSync(filePath, "utf8").trim()
  return body ? body.split(/\r?\n/u).map((line) => JSON.parse(line)) : []
}

describe("IRS EO service-page evidence", () => {
  it("extracts bounded, source-linked candidates without making publishable claims", () => {
    const evidence = extractIrsEoServiceFieldEvidence(
      pageSnapshot("https://provider.example.org/family-support")
    )

    expect(new Set(evidence.map((item) => item.field))).toEqual(
      new Set(["access", "eligibility", "hours", "service", "service_area"])
    )
    expect(evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "hours",
          sourceUrl: "https://provider.example.org/family-support",
          publishable: false,
        }),
        expect.objectContaining({
          field: "eligibility",
          snippet: expect.stringContaining("Durham County residents"),
        }),
      ])
    )
    expect(evidence.every((item) => item.snippet.length <= 500)).toBe(true)
  })

  it("accepts only same-site provider-linked pages", () => {
    expect(
      isProviderLinkedServicePage(
        {
          url: "https://help.provider.example.org/apply",
          providerLinked: true,
          sourceUrl: "https://provider.example.org/",
        },
        "https://provider.example.org/"
      )
    ).toBe(true)
    expect(
      isProviderLinkedServicePage(
        {
          url: "https://provider.example.net/apply",
          providerLinked: true,
          sourceUrl: "https://provider.example.org/",
        },
        "https://provider.example.org/"
      )
    ).toBe(false)
    expect(
      isProviderLinkedServicePage(
        {
          url: "https://provider.example.org/context.submission.url",
          providerLinked: true,
          sourceUrl: "https://provider.example.org/",
        },
        "https://provider.example.org/"
      )
    ).toBe(false)
    expect(
      isProviderLinkedServicePage(
        {
          url: "https://provider.example.org/apply",
          providerLinked: false,
          sourceUrl: "https://provider.example.org/",
        },
        "https://provider.example.org/"
      )
    ).toBe(false)
  })

  it("recognizes compact weekday schedules", () => {
    const evidence = extractIrsEoServiceFieldEvidence({
      ...pageSnapshot("https://provider.example.org/pantry"),
      pageEvidence: {
        textExcerpt: "Food Pantry Hours: Tuesdays from 3 - 6PM.",
      },
    })

    expect(evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "hours",
          snippet: "Food Pantry Hours: Tuesdays from 3 - 6PM.",
        }),
      ])
    )
  })

  it("rejects narrative and non-geographic service-area phrases", () => {
    const evidence = extractIrsEoServiceFieldEvidence({
      ...pageSnapshot("https://provider.example.org/stories"),
      pageEvidence: {
        textExcerpt:
          "I gained experience serving vulnerable communities. The album is now available in physical CD format. Have questions or need assistance? 42 Program Graduates completed the requirements.",
      },
    })

    expect(evidence).toEqual([])
  })

  it("does not retain evidence after an off-site redirect", async () => {
    const url = "https://provider.example.org/family-support"
    const result = await collectIrsEoServiceEvidence({
      researchResult: researchResult(url),
      network: true,
      fetchSnapshot: async () => ({
        ...pageSnapshot(url),
        finalUrl: "https://unrelated.example.net/family-support",
      }),
    })

    expect(result.pageEvidence[0]).toMatchObject({
      status: "off_site_redirect",
      fieldEvidence: [],
    })
    expect(result.researchResult.acquisitionStatus).toBe("website_matched")
  })

  it("uses the confirmed provider page when no service links were retained", async () => {
    const url = "https://provider.example.org/"
    const input = {
      ...researchResult(url),
      websiteUrl: url,
      providerLinkedEvidencePages: [],
    }
    const result = await collectIrsEoServiceEvidence({
      researchResult: input,
      network: true,
      fetchSnapshot: async () => pageSnapshot(url),
    })

    expect(result.attemptedPageCount).toBe(1)
    expect(result.counts.fetchedPages).toBe(1)
    expect(result.researchResult.acquisitionStatus).toBe("evidence_fetched")
  })

  it("does not advance when fetched pages lack explicit service evidence", async () => {
    const url = "https://provider.example.org/contact"
    const result = await collectIrsEoServiceEvidence({
      researchResult: researchResult(url),
      network: true,
      fetchSnapshot: async (pageUrl) => ({
        ...pageSnapshot(pageUrl),
        pageEvidence: {
          ...pageSnapshot(pageUrl).pageEvidence,
          pageTitle: "Contact",
          textExcerpt: "Call us at (919) 555-0100 for more information.",
        },
      }),
    })

    expect(result.counts.fetchedPages).toBeGreaterThan(0)
    expect(result.counts.serviceEvidence).toBe(0)
    expect(result.counts.advanced).toBe(0)
    expect(result.researchResult.acquisitionStatus).toBe("website_matched")
  })

  it("rejects narrative service false positives but retains provider matching", () => {
    const evidence = extractIrsEoServiceFieldEvidence({
      ...pageSnapshot("https://provider.example.org/guardianship"),
      pageEvidence: {
        textExcerpt:
          "A caregiver failed to provide basic needs. Adult Protective Services responded. We match compassionate volunteers with adults who need legal guardianship.",
      },
    })

    expect(evidence.filter((item) => item.field === "service")).toEqual([
      expect.objectContaining({
        snippet: expect.stringContaining("match compassionate volunteers"),
      }),
    ])
  })

  it("uses fresh cache, preserves raw fields, and advances only to evidence fetched", async () => {
    const url = "https://provider.example.org/family-support"
    const snapshot = pageSnapshot(url)
    const result = await collectIrsEoServiceEvidence({
      researchResult: researchResult(url),
      cacheByUrl: new Map([
        [
          url,
          {
            collectorVersion: IRS_EO_SERVICE_EVIDENCE_VERSION,
            fetchedAt: snapshot.checkedAt,
            snapshot,
            url,
          },
        ],
      ]),
      now: new Date("2026-09-01T12:00:00.000Z"),
    })

    expect(result.counts).toMatchObject({
      cacheHits: 1,
      networkRequests: 0,
      fetchedPages: 1,
    })
    expect(result.researchResult).toMatchObject({
      acquisitionStatus: "evidence_fetched",
      services: [],
      serviceAreas: [],
      publicDisplayEligible: false,
      publicationBlocked: true,
    })
    expect(result.aiCalls).toBe(0)
    expect(result.reviewed).toBe(0)
    expect(result.published).toBe(0)
  })

  it("writes a bounded offline canary from cache", () => {
    const directory = mkdtempSync(join(tmpdir(), "resource-map-eo-service-"))
    try {
      const url = "https://provider.example.org/family-support"
      const input = join(directory, "results.jsonl")
      const cache = join(directory, "cache.jsonl")
      const websiteCache = join(directory, "website-cache.jsonl")
      const output = join(directory, "output.jsonl")
      const evidence = join(directory, "evidence.jsonl")
      const report = join(directory, "report.json")
      const snapshot = { ...pageSnapshot(url), checkedAt: new Date().toISOString() }
      writeFileSync(input, `${JSON.stringify(researchResult(url))}\n`)
      writeFileSync(
        websiteCache,
        `${JSON.stringify({
          fetchedAt: snapshot.checkedAt,
          snapshot,
          url,
        })}\n`
      )

      const stdout = execFileSync(
        process.execPath,
        [
          COLLECTOR,
          "--input",
          input,
          "--cache",
          cache,
          "--website-cache",
          websiteCache,
          "--output",
          output,
          "--evidence",
          evidence,
          "--report",
          report,
          "--write",
        ],
        { cwd: ROOT, encoding: "utf8" }
      )
      const summary = JSON.parse(stdout)

      expect(summary.counts).toMatchObject({
        eligibleResults: 1,
        attemptedPages: 2,
        fetchedPages: 1,
        cacheHits: 1,
        websiteCacheSeeds: 1,
        networkRequests: 0,
        needsNetwork: 1,
        aiCalls: 0,
        reviewed: 0,
        published: 0,
      })
      expect(readJsonl(output)[0]).toMatchObject({
        acquisitionStatus: "evidence_fetched",
        publicationBlocked: true,
      })
      expect(readJsonl(evidence)[0].pageEvidence).toHaveLength(2)
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })
})
