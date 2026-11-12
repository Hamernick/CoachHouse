import { execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  IRS_EO_WEBSITE_RESOLUTION_VERSION,
  classifyIrsEoWebsiteCandidate,
  isFreshIrsEoWebsiteSnapshot,
  isStrongIrsEoWebsiteComparison,
  normalizeIrsEoWebsiteCandidateSet,
  resolveIrsEoProviderWebsite,
} from "../../scripts/resource-map/lib/irs-eo-website-resolution.mjs"

const ROOT = process.cwd()
const RESOLVER = join(ROOT, "scripts/resource-map/resolve-irs-eo-websites.mjs")

function readJsonl(filePath: string) {
  const body = readFileSync(filePath, "utf8").trim()
  return body ? body.split(/\r?\n/u).map((line) => JSON.parse(line)) : []
}

function withTempDirectory(callback: (directory: string) => void) {
  const directory = mkdtempSync(join(tmpdir(), "resource-map-eo-websites-"))
  try {
    callback(directory)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

function fetchedSnapshot(url: string, organizationName: string) {
  const visibleText =
    `${organizationName} provides local services.`.toLowerCase()
  return {
    checkedAt: "2026-08-31T12:00:00.000Z",
    contentHash: "source-content-hash",
    contentType: "text/html",
    evidenceSnippet: visibleText,
    fetchStatus: "fetched",
    finalUrl: url,
    httpStatus: 200,
    pageTitle: organizationName,
    visibleText,
    websiteUrl: url,
  }
}

describe("IRS EO provider website resolution", () => {
  it("classifies and deduplicates provider, social, and directory candidates", () => {
    const normalized = normalizeIrsEoWebsiteCandidateSet({
      ein: "12-3456789",
      searchCompleted: true,
      candidates: [
        "https://provider.example.org/#about",
        "https://provider.example.org/",
        "https://www.facebook.com/provider",
        "https://www.charitynavigator.org/ein/123456789",
        {
          url: "https://news.example.com/provider",
          candidateKind: "news",
        },
      ],
    })

    expect(normalized.ein).toBe("123456789")
    expect(normalized.candidates).toHaveLength(4)
    expect(
      normalized.candidates.map(
        (item: { candidateKind: string }) => item.candidateKind
      )
    ).toEqual([
      "provider_website",
      "social",
      "directory",
      "news",
    ])
    expect(
      classifyIrsEoWebsiteCandidate(
        "https://projects.propublica.org/nonprofits/organizations/123456789"
      )
    ).toBe("directory")
  })

  it("requires a strong provider identity match", () => {
    expect(
      isStrongIrsEoWebsiteComparison({
        status: "supported",
        matchedSignals: ["exact_provider_name", "provider_domain"],
        matchedTokens: ["neighborhood", "pantry"],
      })
    ).toBe(true)
    expect(
      isStrongIrsEoWebsiteComparison({
        status: "supported",
        matchedSignals: ["exact_provider_name"],
        matchedTokens: ["community", "services"],
      })
    ).toBe(false)
    expect(
      isStrongIrsEoWebsiteComparison({
        status: "supported",
        matchedSignals: ["exact_provider_name"],
        matchedTokens: ["community", "services"],
        filingGeographySupported: true,
      })
    ).toBe(true)
  })

  it("uses fresh cached evidence without a network request", async () => {
    const url = "https://neighborhoodpantry.example.org/"
    const snapshot = fetchedSnapshot(url, "Neighborhood Pantry")
    const result = await resolveIrsEoProviderWebsite({
      workItem: {
        ein: "123456789",
        organizationName: "Neighborhood Pantry",
      },
      candidateSet: {
        ein: "123456789",
        searchCompleted: true,
        candidates: [{ url }],
      },
      cacheByUrl: new Map([
        [
          url,
          {
            url,
            fetchedAt: snapshot.checkedAt,
            resolverVersion: IRS_EO_WEBSITE_RESOLUTION_VERSION,
            snapshot,
          },
        ],
      ]),
      now: new Date("2026-09-01T12:00:00.000Z"),
    })

    expect(result.counts).toMatchObject({
      cacheHits: 1,
      networkRequests: 0,
      needsNetwork: 0,
    })
    expect(result.researchResult).toMatchObject({
      acquisitionStatus: "website_matched",
      websiteUrl: url,
      providerIdentitySupported: true,
      publicationBlocked: true,
    })
  })

  it("does not resolve stale uncached evidence without explicit network access", async () => {
    const url = "https://provider.example.org/"
    const stale = {
      url,
      fetchedAt: "2026-01-01T00:00:00.000Z",
      resolverVersion: IRS_EO_WEBSITE_RESOLUTION_VERSION,
      snapshot: fetchedSnapshot(url, "Provider Services"),
    }
    expect(
      isFreshIrsEoWebsiteSnapshot(stale, {
        now: new Date("2026-09-01T00:00:00.000Z"),
      })
    ).toBe(false)

    const result = await resolveIrsEoProviderWebsite({
      workItem: { ein: "123456789", organizationName: "Provider Services" },
      candidateSet: {
        ein: "123456789",
        searchCompleted: true,
        candidates: [{ url }],
      },
      cacheByUrl: new Map([[url, stale]]),
      now: new Date("2026-09-01T00:00:00.000Z"),
    })
    expect(result.resolutionStatus).toBe("needs_network")
    expect(result.researchResult).toBeNull()
  })

  it("rejects a lookalike domain and accepts a geographically supported parent provider", async () => {
    const lookalikeUrl = "https://bethelpreschooldurham.example.org/"
    const parentUrl = "https://betheldurham.example.org/early-childhood"
    const lookalikeSnapshot = {
      ...fetchedSnapshot(lookalikeUrl, "Bethel Preschool Durham"),
      visibleText:
        "bethel preschool durham early childhood education tangerang indonesia",
    }
    const parentSnapshot = {
      ...fetchedSnapshot(parentUrl, "Beth El Preschool"),
      visibleText:
        "beth el preschool is open to the wider community in durham nc",
    }
    const result = await resolveIrsEoProviderWebsite({
      workItem: {
        ein: "560940184",
        organizationName: "Beth El Preschool",
        filingAddress: { city: "Durham", state: "NC", postalCode: "27701" },
      },
      candidateSet: {
        ein: "560940184",
        searchCompleted: true,
        candidates: [
          { url: lookalikeUrl, candidateKind: "provider_website" },
          { url: parentUrl, candidateKind: "provider_parent" },
        ],
      },
      cacheByUrl: new Map([
        [
          lookalikeUrl,
          {
            url: lookalikeUrl,
            fetchedAt: lookalikeSnapshot.checkedAt,
            resolverVersion: IRS_EO_WEBSITE_RESOLUTION_VERSION,
            snapshot: lookalikeSnapshot,
          },
        ],
        [
          parentUrl,
          {
            url: parentUrl,
            fetchedAt: parentSnapshot.checkedAt,
            resolverVersion: IRS_EO_WEBSITE_RESOLUTION_VERSION,
            snapshot: parentSnapshot,
          },
        ],
      ]),
      now: new Date("2026-09-01T12:00:00.000Z"),
    })

    expect(result.researchResult).toMatchObject({
      acquisitionStatus: "website_matched",
      websiteUrl: parentUrl,
    })
    expect(result.evaluations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          url: lookalikeUrl,
          filingGeographySupported: false,
        }),
        expect.objectContaining({
          url: parentUrl,
          filingGeographySupported: true,
          resolutionStatus: "strong_match",
        }),
      ])
    )
  })

  it("corroborates exact identity and geography across one parent-provider site", async () => {
    const founderUrl = "https://hopeforkc.example.org/founder"
    const homeUrl = "https://hopeforkc.example.org/"
    const founderSnapshot = {
      ...fetchedSnapshot(founderUrl, "House of Hope Midwest"),
      visibleText: "founder of house of hope midwest in kansas city",
    }
    const homeSnapshot = {
      ...fetchedSnapshot(homeUrl, "House of Hope"),
      visibleText: "house of hope serves north kansas city mo",
    }
    const result = await resolveIrsEoProviderWebsite({
      workItem: {
        ein: "842064036",
        organizationName: "House of Hope Midwest",
        filingAddress: { city: "Kansas City", state: "MO" },
      },
      candidateSet: {
        ein: "842064036",
        searchCompleted: true,
        candidates: [
          { url: founderUrl, candidateKind: "provider_parent" },
          { url: homeUrl, candidateKind: "provider_parent" },
        ],
      },
      cacheByUrl: new Map([
        [
          founderUrl,
          {
            url: founderUrl,
            fetchedAt: founderSnapshot.checkedAt,
            resolverVersion: IRS_EO_WEBSITE_RESOLUTION_VERSION,
            snapshot: founderSnapshot,
          },
        ],
        [
          homeUrl,
          {
            url: homeUrl,
            fetchedAt: homeSnapshot.checkedAt,
            resolverVersion: IRS_EO_WEBSITE_RESOLUTION_VERSION,
            snapshot: homeSnapshot,
          },
        ],
      ]),
      now: new Date("2026-09-01T12:00:00.000Z"),
    })

    expect(result.researchResult).toMatchObject({
      acquisitionStatus: "website_matched",
      websiteUrl: founderUrl,
    })
    expect(result.evaluations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          url: founderUrl,
          sameSiteParentCorroborated: true,
          resolutionStatus: "strong_match",
        }),
      ])
    )
  })

  it("writes bounded offline results from cache and holds directory-only rows", () => {
    withTempDirectory((directory) => {
      const input = join(directory, "work-items.jsonl")
      const candidates = join(directory, "candidates.jsonl")
      const cache = join(directory, "cache.jsonl")
      const output = join(directory, "results.jsonl")
      const evidence = join(directory, "evidence.jsonl")
      const report = join(directory, "report.json")
      const url = "https://neighborhoodpantry.example.org/"
      const snapshot = {
        ...fetchedSnapshot(url, "Neighborhood Pantry"),
        checkedAt: new Date().toISOString(),
      }
      writeFileSync(
        input,
        [
          { ein: "123456789", organizationName: "Neighborhood Pantry" },
          { ein: "987654321", organizationName: "Community Booster Club" },
        ]
          .map((row) => JSON.stringify(row))
          .join("\n") + "\n"
      )
      writeFileSync(
        candidates,
        [
          {
            ein: "123456789",
            searchCompleted: true,
            candidates: [{ url }],
          },
          {
            ein: "987654321",
            searchCompleted: true,
            candidates: ["https://www.charitynavigator.org/ein/987654321"],
          },
        ]
          .map((row) => JSON.stringify(row))
          .join("\n") + "\n"
      )
      writeFileSync(
        cache,
        `${JSON.stringify({
          url,
          fetchedAt: snapshot.checkedAt,
          resolverVersion: IRS_EO_WEBSITE_RESOLUTION_VERSION,
          snapshot,
        })}\n`
      )

      const stdout = execFileSync(
        process.execPath,
        [
          RESOLVER,
          "--input",
          input,
          "--candidates",
          candidates,
          "--cache",
          cache,
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
      const result = JSON.parse(stdout)

      expect(result.counts).toMatchObject({
        candidateSets: 2,
        websiteMatched: 1,
        held: 1,
        cacheHits: 1,
        networkRequests: 0,
        aiCalls: 0,
        reviewed: 0,
        published: 0,
      })
      expect(readJsonl(output).map((row) => row.acquisitionStatus)).toEqual([
        "website_matched",
        "held",
      ])
      expect(readJsonl(evidence)).toHaveLength(2)
    })
  })
})
