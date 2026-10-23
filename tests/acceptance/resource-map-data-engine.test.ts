import { execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { createServer, type RequestListener } from "node:http"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { pathToFileURL } from "node:url"

import { describe, expect, it } from "vitest"

const ROOT = process.cwd()
const FIXTURES = join(ROOT, "tests/fixtures/resource-map-data-engine")
const PACKAGE_JSON = join(ROOT, "package.json")
const DISCOVER = join(ROOT, "scripts/resource-map/data-discover.mjs")
const DISCOVER_SOURCES = join(ROOT, "scripts/resource-map/discover-sources.mjs")
const INGEST = join(ROOT, "scripts/resource-map/data-ingest.mjs")
const REPROCESS = join(ROOT, "scripts/resource-map/reprocess-candidates.mjs")
const SOURCE_DISCOVERY = join(
  ROOT,
  "scripts/resource-map/lib/data-engine/source-discovery.mjs"
)
const CONNECTORS = join(
  ROOT,
  "scripts/resource-map/lib/data-engine/connectors.mjs"
)
const TAXONOMY_CLASSIFIER = join(
  ROOT,
  "scripts/resource-map/lib/data-engine/taxonomy-classifier.mjs"
)
const NORMALIZER = join(
  ROOT,
  "scripts/resource-map/lib/data-engine/normalizer.mjs"
)
const PARSERS = join(ROOT, "scripts/resource-map/lib/data-engine/parsers.mjs")
const GEOCODER = join(ROOT, "scripts/resource-map/lib/data-engine/geocoder.mjs")
const DEDUPE = join(ROOT, "scripts/resource-map/lib/data-engine/dedupe.mjs")
const QUALITY = join(ROOT, "scripts/resource-map/lib/data-engine/quality.mjs")
const CHECK_LINKS = join(ROOT, "scripts/resource-map/check-links.mjs")
const RUN_LOCAL_JOBS = join(ROOT, "scripts/resource-map/run-local-jobs.mjs")
const CHECK_SOURCE_FRESHNESS = join(
  ROOT,
  "scripts/resource-map/check-local-source-freshness.mjs"
)
const MIGRATION = join(
  ROOT,
  "supabase/migrations/20260628162000_resource_map_data_engine_contract.sql"
)
const SCHEMA_INDEX = join(ROOT, "src/lib/supabase/schema/tables/index.ts")
const RUNBOOK = join(ROOT, "docs/resource-map-data-engine-runbook.md")
const LOCAL_README = join(ROOT, "data/resource-map/README.md")

function withTempDir(callback: (dir: string) => void) {
  const directory = mkdtempSync(join(tmpdir(), "resource-map-data-engine-"))
  try {
    callback(directory)
  } finally {
    rmSync(directory, { force: true, recursive: true })
  }
}

function readJsonl(filePath: string) {
  return readFileSync(filePath, "utf8")
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>)
}

async function withFixtureServer(
  handler: RequestListener,
  callback: (baseUrl: string) => Promise<void>
) {
  const server = createServer(handler)
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve)
  })
  const address = server.address()
  if (!address || typeof address === "string") {
    server.close()
    throw new Error("Unable to start fixture server.")
  }

  try {
    await callback(`http://127.0.0.1:${address.port}`)
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
}

function buildZip(entries: Array<{ name: string; body: string }>) {
  const localParts: Buffer[] = []
  const centralParts: Buffer[] = []
  let offset = 0

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8")
    const body = Buffer.from(entry.body, "utf8")
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0, 6)
    local.writeUInt16LE(0, 8)
    local.writeUInt32LE(0, 10)
    local.writeUInt32LE(0, 14)
    local.writeUInt32LE(body.length, 18)
    local.writeUInt32LE(body.length, 22)
    local.writeUInt16LE(name.length, 26)
    local.writeUInt16LE(0, 28)
    localParts.push(local, name, body)

    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0, 8)
    central.writeUInt16LE(0, 10)
    central.writeUInt32LE(0, 12)
    central.writeUInt32LE(0, 16)
    central.writeUInt32LE(body.length, 20)
    central.writeUInt32LE(body.length, 24)
    central.writeUInt16LE(name.length, 28)
    central.writeUInt16LE(0, 30)
    central.writeUInt16LE(0, 32)
    central.writeUInt16LE(0, 34)
    central.writeUInt16LE(0, 36)
    central.writeUInt32LE(0, 38)
    central.writeUInt32LE(offset, 42)
    centralParts.push(central, name)
    offset += local.length + name.length + body.length
  }

  const central = Buffer.concat(centralParts)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(0, 4)
  end.writeUInt16LE(0, 6)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(central.length, 12)
  end.writeUInt32LE(offset, 16)
  end.writeUInt16LE(0, 20)

  return Buffer.concat([...localParts, central, end])
}

function inlineCell(ref: string, value: string) {
  return `<c r="${ref}" t="inlineStr"><is><t>${value}</t></is></c>`
}

function buildXlsxFixture() {
  const headers = [
    "organizationName",
    "title",
    "description",
    "category",
    "address",
    "phone",
    "websiteUrl",
  ]
  const values = [
    "Neighborhood Workforce Center",
    "Resume help and job search",
    "Free job search support for local residents.",
    "Job search",
    "500 Work Ave, Chicago, IL 60607",
    "312-555-0500",
    "https://workforce.example.org",
  ]
  const columns = ["A", "B", "C", "D", "E", "F", "G"]
  const sheet = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>',
    `<row r="1">${headers.map((header, index) => inlineCell(`${columns[index]}1`, header)).join("")}</row>`,
    `<row r="2">${values.map((value, index) => inlineCell(`${columns[index]}2`, value)).join("")}</row>`,
    "</sheetData></worksheet>",
  ].join("")

  return buildZip([{ name: "xl/worksheets/sheet1.xml", body: sheet }])
}

function buildPrefixedXlsxFixture() {
  const sheet = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<x:worksheet xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><x:sheetData>',
    '<x:row r="1"><x:c r="A1" t="str"><x:v>Directory title</x:v></x:c></x:row>',
    '<x:row r="5"><x:c r="A5" t="str"><x:v>Organization</x:v></x:c><x:c r="B5" t="str"><x:v>Address</x:v></x:c><x:c r="C5" t="str"><x:v>Source URLs</x:v></x:c></x:row>',
    '<x:row r="6"><x:c r="A6" t="str"><x:v>Neighborhood Pantry</x:v></x:c><x:c r="B6" t="str" /><x:c r="C6" t="str"><x:v>https://one.example.org\nhttps://two.example.org</x:v></x:c></x:row>',
    "</x:sheetData></x:worksheet>",
  ].join("")

  return buildZip([{ name: "xl/worksheets/sheet1.xml", body: sheet }])
}

describe("resource map local data engine", () => {
  it("parses namespaced Excel exports with metadata rows and blank cells", async () => {
    const { parseExcelRows } = await import(pathToFileURL(PARSERS).href)
    const workbook = buildPrefixedXlsxFixture()
    const rows = parseExcelRows(
      workbook.toString("base64"),
      { raw_payload: { rawTextEncoding: "base64" } },
      { metadata: { headerRow: 5 } }
    )

    expect(rows).toEqual([
      {
        Address: "",
        Organization: "Neighborhood Pantry",
        "Source URLs": "https://one.example.org\nhttps://two.example.org",
      },
    ])
  })

  it("discovers source-registry candidates without writing by default", () => {
    const output = execFileSync(
      process.execPath,
      [
        DISCOVER,
        "--location",
        "Chicago, IL",
        "--categories",
        "food,health",
        "--limit",
        "5",
      ],
      { cwd: ROOT, encoding: "utf8" }
    )

    expect(output).toContain("Dry run: discovered 5 source candidates")
    expect(output).toContain("Data.gov - Chicago, IL - food")
    expect(output).toContain("(ckan/official)")
  })

  it("dry-runs discovered source candidates through source-registry intake", () => {
    const output = execFileSync(
      process.execPath,
      [
        DISCOVER,
        "--location",
        "Chicago, IL",
        "--categories",
        "food",
        "--limit",
        "2",
        "--registry-dry-run",
      ],
      { cwd: ROOT, encoding: "utf8" }
    )

    expect(output).toContain("Dry run: discovered 2 source candidates")
    expect(output).toContain(
      "Dry run: parsed 2 source candidates. Re-run with --apply to upsert resource_map_sources."
    )
    expect(output).toContain("Data.gov - Chicago, IL - food")
  })

  it("dry-runs broken-link checks without network by default", () => {
    withTempDir((directory) => {
      const input = join(directory, "candidate-records.jsonl")
      writeFileSync(
        input,
        [
          JSON.stringify({
            sourceRecordId: "food-1",
            sourceUrl: "https://source.example/food-1",
            extractedFields: {
              websiteUrl: "https://example.org/pantry#hours",
              links: [
                { type: "intake", url: "https://example.org/intake" },
                { type: "bad", url: "not a url" },
              ],
            },
          }),
        ].join("\n")
      )

      const output = execFileSync(
        process.execPath,
        [CHECK_LINKS, "--input", input],
        { cwd: ROOT, encoding: "utf8" }
      )

      expect(output).toContain("Dry run: found 3 unique HTTP URLs")
      expect(output).toContain("1 malformed URLs")
      expect(output).toContain("Re-run with --network true")
    })
  })

  it("annotates link-check failures onto candidate quality flags", () => {
    withTempDir((directory) => {
      const input = join(directory, "candidate-records.jsonl")
      const annotated = join(directory, "annotated-records.jsonl")
      writeFileSync(
        input,
        [
          JSON.stringify({
            sourceRecordId: "food-1",
            sourceUrl: "https://source.example/food-1",
            extractedFields: {
              category: "Food Pantries",
              address: "100 Pantry Ave, Chicago, IL 60601",
              eligibility: "Open to local residents.",
              phone: "312-555-0100",
              websiteUrl: "https://example.org/pantry#hours",
              links: [{ type: "bad", url: "not a url" }],
            },
          }),
        ].join("\n")
      )

      const output = execFileSync(
        process.execPath,
        [CHECK_LINKS, "--input", input, "--annotate-output", annotated],
        { cwd: ROOT, encoding: "utf8" }
      )
      const [record] = readJsonl(annotated)
      const fields = record.extractedFields as Record<string, unknown>
      const linkChecks = fields.linkChecks as Array<Record<string, unknown>>
      const dataQuality = fields.dataQuality as Record<string, unknown>
      const flags = record.qualityFlags as Array<Record<string, unknown>>

      expect(output).toContain("Dry run: found 2 unique HTTP URLs")
      expect(output).toContain("Annotated link-check evidence")
      expect(linkChecks).toEqual([
        expect.objectContaining({
          url: "not a url",
          kind: "bad",
          status: "malformed",
          ok: false,
          reason: "invalid_or_non_http_url",
          checkerVersion: "2026-06-28",
        }),
      ])
      expect(flags).toEqual([
        expect.objectContaining({
          code: "broken_url",
          severity: "review",
        }),
      ])
      expect(dataQuality.flags).toEqual(flags)
      expect(dataQuality.linkChecks).toEqual(linkChecks)
      expect(record.needsReview).toBe(true)
    })
  })

  it("reports local source freshness without Supabase or network access", () => {
    withTempDir((directory) => {
      writeFileSync(
        join(directory, "source-registry.jsonl"),
        [
          {
            sourceId: "current-source",
            slug: "current-source",
            name: "Current source",
            connectorType: "json",
          },
          {
            sourceId: "stale-source",
            slug: "stale-source",
            name: "Stale source",
            connectorType: "json",
          },
          {
            sourceId: "failed-source",
            slug: "failed-source",
            name: "Failed source",
            connectorType: "json",
          },
          {
            sourceId: "never-source",
            slug: "never-source",
            name: "Never fetched source",
            connectorType: "json",
          },
        ]
          .map((row) => JSON.stringify(row))
          .join("\n")
      )
      writeFileSync(
        join(directory, "raw-payloads.jsonl"),
        [
          {
            source_id: "current-source",
            fetch_status: "fetched",
            fetched_at: new Date().toISOString(),
          },
          {
            source_id: "stale-source",
            fetch_status: "fetched",
            fetched_at: "2020-01-01T00:00:00.000Z",
          },
          {
            source_id: "failed-source",
            fetch_status: "failed",
            fetched_at: new Date().toISOString(),
          },
        ]
          .map((row) => JSON.stringify(row))
          .join("\n")
      )

      const output = execFileSync(
        process.execPath,
        [CHECK_SOURCE_FRESHNESS, "--stale-days", "30", "--only-stale"],
        {
          cwd: ROOT,
          encoding: "utf8",
          env: { ...process.env, RESOURCE_MAP_ENGINE_DIR: directory },
        }
      )

      expect(output).toContain("stale")
      expect(output).toContain("stale-source")
      expect(output).toContain("failed")
      expect(output).toContain("failed-source")
      expect(output).toContain("never_fetched")
      expect(output).toContain("never-source")
      expect(output).not.toContain("current-source")
    })
  })

  it("selects failed and stale sources for local refresh dry-runs", () => {
    withTempDir((directory) => {
      const registry = join(directory, "source-registry.jsonl")
      const rawPayloads = join(directory, "raw-payloads.jsonl")
      const failedSource = {
        sourceId: "retry-json",
        slug: "retry-json",
        name: "Retry JSON",
        connectorType: "json",
        rawUrl: join(FIXTURES, "sample.json"),
      }
      const staleSource = {
        sourceId: "stale-json",
        slug: "stale-json",
        name: "Stale JSON",
        connectorType: "json",
        rawUrl: join(FIXTURES, "sample.json"),
      }
      const currentSource = {
        sourceId: "current-json",
        slug: "current-json",
        name: "Current JSON",
        connectorType: "json",
        rawUrl: join(FIXTURES, "sample.json"),
      }
      writeFileSync(
        registry,
        [failedSource, staleSource, currentSource]
          .map((row) => JSON.stringify(row))
          .join("\n")
      )
      writeFileSync(
        rawPayloads,
        [
          {
            source_id: "retry-json",
            raw_url: "https://bad.example/source.json",
            raw_text: "",
            checksum:
              "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            fetch_status: "failed",
            fetched_at: new Date().toISOString(),
          },
          {
            source_id: "stale-json",
            raw_url: staleSource.rawUrl,
            raw_text: "{}",
            checksum:
              "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
            fetch_status: "fetched",
            fetched_at: "2020-01-01T00:00:00.000Z",
          },
          {
            source_id: "current-json",
            raw_url: currentSource.rawUrl,
            raw_text: "{}",
            checksum:
              "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
            fetch_status: "fetched",
            fetched_at: new Date().toISOString(),
          },
        ]
          .map((row) => JSON.stringify(row))
          .join("\n")
      )

      const retryOutput = execFileSync(
        process.execPath,
        [INGEST, "--retry-failed", "--registry", registry],
        {
          cwd: ROOT,
          encoding: "utf8",
          env: { ...process.env, RESOURCE_MAP_ENGINE_DIR: directory },
        }
      )
      const staleOutput = execFileSync(
        process.execPath,
        [INGEST, "--stale", "--stale-days", "30", "--registry", registry],
        {
          cwd: ROOT,
          encoding: "utf8",
          env: { ...process.env, RESOURCE_MAP_ENGINE_DIR: directory },
        }
      )

      expect(retryOutput).toContain("Dry run: selected 1 sources")
      expect(retryOutput).toContain("parsed 1")
      expect(staleOutput).toContain("Dry run: selected 1 sources")
      expect(staleOutput).toContain("parsed 1")
    })
  })

  it("runs local maintenance jobs through one dry-run-first orchestrator", () => {
    withTempDir((directory) => {
      const output = execFileSync(
        process.execPath,
        [
          RUN_LOCAL_JOBS,
          "--jobs",
          "source_freshness,broken_link_check",
          "--write",
        ],
        {
          cwd: ROOT,
          encoding: "utf8",
          env: { ...process.env, RESOURCE_MAP_ENGINE_DIR: directory },
        }
      )
      const summary = JSON.parse(output)
      const runs = readJsonl(join(directory, "runs.jsonl"))

      expect(summary).toMatchObject({
        status: "completed",
        write: true,
      })
      expect(summary.jobs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            job: "source_freshness",
            status: "completed",
          }),
          expect.objectContaining({
            job: "broken_link_check",
            status: "skipped",
          }),
        ])
      )
      expect(runs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ kind: "local_job_runner" }),
        ])
      )
    })
  })

  it("runs opt-in source discovery and ingestion jobs through the local orchestrator", () => {
    withTempDir((directory) => {
      const discoveredSources = join(directory, "discovered-sources.jsonl")
      const discoveryOutput = execFileSync(
        process.execPath,
        [
          RUN_LOCAL_JOBS,
          "--jobs",
          "source_discovery",
          "--location",
          "Chicago, IL",
          "--categories",
          "food",
          "--limit",
          "1",
          "--output",
          discoveredSources,
          "--registry-dry-run",
          "--write",
        ],
        {
          cwd: ROOT,
          encoding: "utf8",
          env: { ...process.env, RESOURCE_MAP_ENGINE_DIR: directory },
        }
      )
      const discoverySummary = JSON.parse(discoveryOutput)
      expect(discoverySummary.jobs).toEqual([
        expect.objectContaining({
          job: "source_discovery",
          status: "completed",
          output: expect.stringContaining(
            "Dry run: parsed 1 source candidates"
          ),
        }),
      ])
      expect(readJsonl(discoveredSources)).toHaveLength(1)

      const fixture = join(directory, "runner-resource.json")
      const registry = join(directory, "source-registry.jsonl")
      const candidatesOutput = join(directory, "runner-candidates.jsonl")
      writeFileSync(
        fixture,
        JSON.stringify([
          {
            organizationName: "Runner Food Pantry",
            title: "Emergency groceries",
            description: "Free food pantry for nearby residents.",
            category: "Food Pantry",
            address: "10 Runner Ave, Chicago, IL 60601",
            latitude: 41.88,
            longitude: -87.63,
            phone: "312-555-0199",
            websiteUrl: "https://runner-pantry.example.org",
          },
        ])
      )
      writeFileSync(
        registry,
        `${JSON.stringify({
          sourceId: "runner-json-source",
          slug: "runner-json-source",
          name: "Runner JSON Source",
          connectorType: "json",
          sourceType: "api",
          trustLevel: "official",
          rawUrl: fixture,
          publicDisplayAllowed: true,
          categories: ["food"],
          coverageAreas: ["Chicago, IL"],
        })}\n`
      )

      const sourceOutput = execFileSync(
        process.execPath,
        [
          RUN_LOCAL_JOBS,
          "--jobs",
          "source_ingestion",
          "--source",
          "runner-json-source",
          "--registry",
          registry,
          "--output",
          candidatesOutput,
          "--network",
          "true",
          "--replace-source-candidates",
          "--write",
        ],
        {
          cwd: ROOT,
          encoding: "utf8",
          env: { ...process.env, RESOURCE_MAP_ENGINE_DIR: directory },
        }
      )
      const sourceSummary = JSON.parse(sourceOutput)
      expect(sourceSummary.metrics).toMatchObject({
        fetched_count: 1,
        parsed_count: 1,
        normalized_count: 1,
        classified_count: 1,
        deduped_count: 0,
        flagged_count: expect.any(Number),
      })
      expect(sourceSummary.jobs).toEqual([
        expect.objectContaining({
          job: "source_ingestion",
          status: "completed",
          output: expect.stringContaining("Wrote 1 candidate records"),
          metrics: expect.objectContaining({
            fetched_count: 1,
            parsed_count: 1,
            normalized_count: 1,
            classified_count: 1,
          }),
          childRuns: expect.arrayContaining([
            expect.objectContaining({
              kind: "source_ingestion",
              fetched_count: 1,
              parsed_count: 1,
            }),
          ]),
        }),
      ])

      const connectorOutput = execFileSync(
        process.execPath,
        [
          RUN_LOCAL_JOBS,
          "--jobs",
          "connector_ingestion",
          "--type",
          "json",
          "--registry",
          registry,
        ],
        {
          cwd: ROOT,
          encoding: "utf8",
          env: { ...process.env, RESOURCE_MAP_ENGINE_DIR: directory },
        }
      )
      const connectorSummary = JSON.parse(connectorOutput)
      expect(connectorSummary.jobs).toEqual([
        expect.objectContaining({
          job: "connector_ingestion",
          status: "completed",
          output: expect.stringContaining("Dry run: selected 1 sources"),
        }),
      ])

      const candidates = readJsonl(candidatesOutput)
      const runs = readJsonl(join(directory, "runs.jsonl"))
      expect(candidates).toHaveLength(1)
      expect(runs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ kind: "source_discovery" }),
          expect.objectContaining({ kind: "source_ingestion" }),
          expect.objectContaining({ kind: "local_job_runner" }),
        ])
      )
    })
  }, 15_000)

  it("reprocesses existing candidates with current taxonomy and quality logic", () => {
    withTempDir((directory) => {
      const registry = join(directory, "source-registry.jsonl")
      const input = join(directory, "candidate-records.jsonl")
      const output = join(directory, "candidate-records.reprocessed.jsonl")
      writeFileSync(
        registry,
        `${JSON.stringify({
          sourceId: "cooling-fixture-source",
          slug: "cooling-fixture-source",
          name: "Official Cooling Centers",
          sourceType: "api",
          trustLevel: "official",
          homepageUrl: "https://city.example.gov",
          publicDisplayAllowed: true,
        })}\n`
      )
      writeFileSync(
        input,
        `${JSON.stringify({
          sourceRecordId: "cooling-1",
          sourceId: "cooling-fixture-source",
          sourceName: "Official Cooling Centers",
          sourceUrl: "https://city.example.gov/cooling-centers",
          sourceType: "api",
          lastSeenAt: "2026-06-30T12:00:00.000Z",
          lastScrapedAt: "2026-06-30T12:00:00.000Z",
          extractedFields: {
            organizationName: "Main Library Cooling Center",
            title: "Main Library Cooling Center",
            description: "Public library opened as a cooling center.",
            sourceCategoryText: "Cooling Centers; Public Library",
            category: "community",
            subcategory: "community_libraries",
            resourceCategories: ["community", "community_libraries"],
            primaryResourceCategory: "community_libraries",
            taxonomyClassification: {
              needsReview: true,
              flags: ["ambiguous_top_match"],
            },
            address: "1 Main St",
            city: "Chicago",
            state: "IL",
            latitude: 41.88,
            longitude: -87.63,
            phone: "312-555-0100",
            websiteUrl: "https://city.example.gov/cooling-centers",
          },
          qualityFlags: [
            {
              code: "low_confidence_category",
              severity: "review",
              message: "Old classifier state.",
            },
          ],
          fieldEvidence: [
            {
              fieldPath: "extractedFields.sourceCategoryText",
              fieldValue: "Cooling Centers; Public Library",
              confidenceScore: 90,
              sourceUrl: "https://city.example.gov/cooling-centers",
              observedAt: "2026-06-30T12:00:00.000Z",
              evidenceType: "source",
              derivedFrom: [],
              transformation: null,
            },
            {
              fieldPath: "extractedFields.taxonomyClassification",
              fieldValue: { flags: ["ambiguous_top_match"] },
              confidenceScore: 55,
              sourceUrl: "https://city.example.gov/cooling-centers",
              observedAt: "2026-06-30T12:00:00.000Z",
              evidenceType: "derived",
              derivedFrom: ["extractedFields.sourceCategoryText"],
              transformation: "deterministic_taxonomy_classifier",
            },
          ],
        })}\n`
      )

      const dryRun = execFileSync(
        process.execPath,
        [
          REPROCESS,
          "--input",
          input,
          "--registry",
          registry,
          "--output",
          output,
        ],
        {
          cwd: ROOT,
          encoding: "utf8",
          env: { ...process.env, RESOURCE_MAP_ENGINE_DIR: directory },
        }
      )
      expect(dryRun).toContain("Dry run: reprocessed 1 candidate records")
      expect(() => readJsonl(output)).toThrow()

      const writeOutput = execFileSync(
        process.execPath,
        [
          REPROCESS,
          "--input",
          input,
          "--registry",
          registry,
          "--output",
          output,
          "--write",
        ],
        {
          cwd: ROOT,
          encoding: "utf8",
          env: { ...process.env, RESOURCE_MAP_ENGINE_DIR: directory },
        }
      )
      expect(writeOutput).toContain("Wrote 1 reprocessed candidate records")

      const [candidate] = readJsonl(output) as Array<Record<string, any>>
      expect(candidate.extractedFields.primaryResourceCategory).toBe(
        "emergency_cooling_centers"
      )
      expect(candidate.extractedFields.resourceCategories).toEqual(
        expect.arrayContaining(["environment", "emergency_cooling_centers"])
      )
      expect(candidate.extractedFields.resourceCategories).not.toContain(
        "emergency"
      )
      expect(
        candidate.extractedFields.taxonomyClassification.flags
      ).not.toContain("ambiguous_top_match")
      expect(candidate.qualityFlags).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: "low_confidence_category" }),
        ])
      )
      expect(candidate.fieldEvidence).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            fieldPath: "extractedFields.sourceCategoryText",
            evidenceType: "source",
          }),
          expect.objectContaining({
            fieldPath: "extractedFields.taxonomyClassification",
            evidenceType: "derived",
            transformation: "deterministic_taxonomy_classifier",
          }),
          expect.objectContaining({
            fieldPath: "extractedFields.dataQuality",
            evidenceType: "derived",
            transformation: "attach_quality_metadata",
          }),
        ])
      )
      expect(readJsonl(join(directory, "runs.jsonl"))).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "candidate_reprocess",
            parsed_count: 1,
            normalized_count: 1,
            classified_count: 1,
          }),
        ])
      )
    })
  })

  it("writes discovered source-registry candidates and a local discovery run", () => {
    withTempDir((directory) => {
      const engineDir = join(directory, "engine")
      const output = join(directory, "sources.jsonl")
      execFileSync(
        process.execPath,
        [
          DISCOVER,
          "--location",
          "Chicago, IL",
          "--categories",
          "food",
          "--limit",
          "2",
          "--write",
          "--output",
          output,
        ],
        {
          cwd: ROOT,
          encoding: "utf8",
          env: { ...process.env, RESOURCE_MAP_ENGINE_DIR: engineDir },
        }
      )

      const sources = readJsonl(output)
      const runs = readJsonl(join(engineDir, "runs.jsonl"))
      expect(sources).toHaveLength(2)
      expect(sources[0]).toMatchObject({
        discoveryStatus: "candidate",
        manualConfirmationRequired: true,
      })
      expect(runs[0]).toMatchObject({
        kind: "source_discovery",
        status: "completed",
        parsed_count: 2,
        normalized_count: 2,
      })
    })
  })

  it("keeps directory source discovery compatible with source-registry intake", async () => {
    const { buildSourceDiscoveryCandidates } = await import(
      pathToFileURL(SOURCE_DISCOVERY).href
    )
    const { buildSourcePayload } = await import(
      pathToFileURL(DISCOVER_SOURCES).href
    )
    const candidates = buildSourceDiscoveryCandidates({
      locations: ["Chicago, IL"],
      categories: ["food"],
    })
    const directoryCandidates = candidates.filter(
      (candidate: Record<string, unknown>) =>
        candidate.sourceType === "directory"
    )
    const sourceTemplates = candidates.map(
      (candidate: Record<string, unknown>) =>
        (candidate.metadata as Record<string, unknown> | undefined)
          ?.sourceTemplate
    )
    const civicPortalCandidates = candidates.filter(
      (candidate: Record<string, unknown>) =>
        (candidate.metadata as Record<string, unknown> | undefined)
          ?.sourceFamily === "civic_open_data_portal"
    )

    expect(directoryCandidates.length).toBeGreaterThanOrEqual(3)
    expect(sourceTemplates).toEqual(
      expect.arrayContaining([
        "211_directory",
        "food_bank_directory",
        "shelter_directory",
        "clinic_directory",
        "library_directory",
        "school_directory",
        "faith_community_directory",
        "nonprofit_directory",
        "mutual_aid_directory",
        "public_benefits_directory",
      ])
    )
    expect(civicPortalCandidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          slug: "chicago-il-food-city-open-data-portal",
          connectorType: "socrata",
          trustLevel: "official",
          metadata: expect.objectContaining({ portalScope: "city" }),
        }),
        expect.objectContaining({
          slug: "chicago-il-food-county-open-data-portal",
          connectorType: "arcgis",
          trustLevel: "official",
          metadata: expect.objectContaining({ portalScope: "county" }),
        }),
        expect.objectContaining({
          slug: "chicago-il-food-state-open-data-portal",
          connectorType: "ckan",
          trustLevel: "official",
          metadata: expect.objectContaining({ portalScope: "state" }),
        }),
      ])
    )
    expect(directoryCandidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          slug: "chicago-il-food-faith-community-directory",
          connectorType: "static_html",
          sourceType: "directory",
          ingestionReadiness: "lead",
          metadata: expect.objectContaining({
            sourceFamily: "faith_community_directory",
            sourceRegistryTable: "resource_map_sources",
            rawStoreTable: "resource_map_raw_ingestion_records",
            connectorSupported: true,
            connectorReady: false,
          }),
        }),
      ])
    )
    expect(candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          slug: "chicago-il-food-data-gov",
          ingestionReadiness: "ready",
          metadata: expect.objectContaining({
            sourceFamily: "data_gov",
            connectorReady: true,
          }),
        }),
        expect.objectContaining({
          slug: "chicago-il-food-osm-overpass",
          ingestionReadiness: "lead",
          metadata: expect.objectContaining({
            sourceFamily: "osm_overpass",
            connectorReady: false,
          }),
        }),
      ])
    )
    expect(() =>
      execFileSync(
        process.execPath,
        [
          DISCOVER,
          "--location",
          "Chicago, IL",
          "--categories",
          "food",
          "--limit",
          "6",
          "--registry-apply",
        ],
        { cwd: ROOT, encoding: "utf8" }
      )
    ).toThrow(/Refusing --registry-apply/)

    const payload = buildSourcePayload(
      {
        sourceId: "fixture-directory",
        slug: "fixture-directory",
        name: "Fixture directory",
        sourceType: "directory",
        trustLevel: "community",
        connectorType: "static_html",
        rawUrl: "https://resources.example.org/directory",
        discoveryQueries: ["Chicago food directory"],
        metadata: {
          sourceTemplate: "fixture_directory",
          rawStoreTable: "resource_map_raw_ingestion_records",
        },
      },
      new Map([["run-label", "fixture-run"]])
    )
    expect(payload.metadata).toMatchObject({
      sourceId: "fixture-directory",
      connectorType: "static_html",
      rawUrl: "https://resources.example.org/directory",
      rawStoreTable: "resource_map_raw_ingestion_records",
      discoveryQueries: ["Chicago food directory"],
      discoveryRunLabel: "fixture-run",
      sourceTemplate: "fixture_directory",
    })

    withTempDir((directory) => {
      const input = join(directory, "sources.json")
      writeFileSync(
        input,
        JSON.stringify([
          {
            slug: "fixture-directory",
            name: "Fixture directory",
            sourceType: "directory",
            trustLevel: "community",
          },
        ])
      )

      const output = execFileSync(
        process.execPath,
        [DISCOVER_SOURCES, "--input", input],
        { cwd: ROOT, encoding: "utf8" }
      )

      expect(output).toContain("fixture-directory")
      expect(output).toContain("(directory)")
      expect(output).not.toContain("(manual)")
    })
  })

  it("turns local catalog discovery payloads into source-registry candidates", () => {
    withTempDir((directory) => {
      const output = join(directory, "catalog-sources.jsonl")
      const engineDir = join(directory, "engine")
      const catalogInputs = [
        ["ckan", join(FIXTURES, "catalog-ckan.json")],
        ["socrata", join(FIXTURES, "catalog-socrata.json")],
        ["arcgis", join(FIXTURES, "catalog-arcgis.json")],
        ["github", join(FIXTURES, "catalog-github.json")],
        ["common_crawl", join(FIXTURES, "catalog-common-crawl.jsonl")],
        ["sitemap", join(FIXTURES, "sitemap.xml")],
        ["robots", join(FIXTURES, "robots.txt")],
      ]

      for (const [provider, input] of catalogInputs) {
        execFileSync(
          process.execPath,
          [
            DISCOVER,
            "--location",
            "Chicago, IL",
            "--categories",
            "food",
            "--templates",
            "false",
            "--catalog-provider",
            provider,
            "--catalog-input",
            input,
            "--write",
            "--append",
            "--output",
            output,
          ],
          {
            cwd: ROOT,
            encoding: "utf8",
            env: { ...process.env, RESOURCE_MAP_ENGINE_DIR: engineDir },
          }
        )
      }

      const sources = readJsonl(output)
      expect(sources).toHaveLength(7)
      expect(sources).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            rawUrl: "https://data.example.org/food-pantries.csv",
            connectorType: "csv",
            metadata: expect.objectContaining({
              catalogProvider: "ckan",
              parsedFromCatalog: true,
            }),
          }),
          expect.objectContaining({
            rawUrl: "https://data.city.example.org/resource/abcd-1234.json",
            connectorType: "socrata",
            metadata: expect.objectContaining({
              catalogProvider: "socrata",
            }),
          }),
          expect.objectContaining({
            rawUrl:
              "https://services.example.org/arcgis/rest/services/CoolingCenters/FeatureServer/0",
            connectorType: "arcgis",
            metadata: expect.objectContaining({
              catalogProvider: "arcgis",
            }),
          }),
          expect.objectContaining({
            rawUrl:
              "https://raw.githubusercontent.com/example/chicago-resources/main/data/food-pantries.json",
            connectorType: "json",
            sourceType: "manual",
            licenseLabel: "CC-BY-4.0",
            attribution: "example/chicago-resources",
            metadata: expect.objectContaining({
              catalogProvider: "github",
              repositoryFullName: "example/chicago-resources",
            }),
          }),
          expect.objectContaining({
            rawUrl: "https://community.example.org/resources/food-pantries",
            connectorType: "static_html",
            sourceType: "scrape",
            metadata: expect.objectContaining({
              catalogProvider: "common_crawl",
              digest: "COMMONCRAWLFOOD123",
            }),
          }),
          expect.objectContaining({
            rawUrl: "https://mutualaid.example.org/resources",
            connectorType: "static_html",
            sourceType: "scrape",
            metadata: expect.objectContaining({
              catalogProvider: "sitemap",
            }),
          }),
          expect.objectContaining({
            rawUrl: "https://resources.example.org/sitemap.xml",
            connectorType: "sitemap",
            sourceType: "scrape",
            metadata: expect.objectContaining({
              catalogProvider: "robots",
            }),
          }),
        ])
      )
      expect(sources.every((source) => source.manualConfirmationRequired)).toBe(
        true
      )
    })
  })

  it("ingests source-registry rows whose connector details live in metadata", () => {
    withTempDir((directory) => {
      const registry = join(directory, "sources.jsonl")
      const output = join(directory, "candidates.jsonl")
      const engineDir = join(directory, "engine")
      writeFileSync(
        registry,
        JSON.stringify({
          slug: "metadata-backed-json",
          name: "Metadata backed JSON",
          sourceType: "api",
          trustLevel: "partner",
          metadata: {
            sourceId: "metadata-backed-json",
            connectorType: "json",
            rawUrl: join(FIXTURES, "sample.json"),
            rawStoreTable: "resource_map_raw_ingestion_records",
            discoveryQueries: ["metadata-backed fixture"],
          },
        })
      )

      const ingestOutput = execFileSync(
        process.execPath,
        [
          INGEST,
          "--registry",
          registry,
          "--source",
          "metadata-backed-json",
          "--write",
          "--output",
          output,
        ],
        {
          cwd: ROOT,
          encoding: "utf8",
          env: { ...process.env, RESOURCE_MAP_ENGINE_DIR: engineDir },
        }
      )
      const rawPayloads = readJsonl(join(engineDir, "raw-payloads.jsonl"))
      const candidates = readJsonl(output)

      expect(ingestOutput).toContain("Wrote")
      expect(rawPayloads).toEqual([
        expect.objectContaining({
          source_id: "metadata-backed-json",
          fetch_status: "fetched",
          raw_payload: expect.objectContaining({
            connectorType: "json",
          }),
        }),
      ])
      expect(candidates.length).toBeGreaterThan(0)
      expect(candidates[0]).toMatchObject({
        sourceName: "Metadata backed JSON",
        sourceType: "api",
      })
    })
  })

  it("upserts candidate output so source retries do not erase other sources", () => {
    withTempDir((directory) => {
      const registry = join(directory, "sources.jsonl")
      const sourceA = join(directory, "source-a.json")
      const sourceB = join(directory, "source-b.json")
      const output = join(directory, "candidates.jsonl")
      const engineDir = join(directory, "engine")
      writeFileSync(
        sourceA,
        JSON.stringify([
          {
            sourceRecordId: "record-a",
            organizationName: "Original Pantry",
            title: "Original Pantry",
            category: "Food Pantry",
            latitude: 41.88,
            longitude: -87.63,
          },
        ])
      )
      writeFileSync(
        sourceB,
        JSON.stringify([
          {
            sourceRecordId: "record-b",
            organizationName: "Community Clinic",
            title: "Community Clinic",
            category: "Primary Care",
            latitude: 41.89,
            longitude: -87.64,
          },
        ])
      )
      writeFileSync(
        registry,
        [
          {
            sourceId: "source-a",
            slug: "source-a",
            name: "Source A",
            connectorType: "json",
            sourceType: "api",
            trustLevel: "official",
            rawUrl: sourceA,
          },
          {
            sourceId: "source-b",
            slug: "source-b",
            name: "Source B",
            connectorType: "json",
            sourceType: "api",
            trustLevel: "official",
            rawUrl: sourceB,
          },
        ]
          .map((source) => JSON.stringify(source))
          .join("\n")
      )

      execFileSync(
        process.execPath,
        [
          INGEST,
          "--registry",
          registry,
          "--all",
          "--write",
          "--output",
          output,
        ],
        {
          cwd: ROOT,
          encoding: "utf8",
          env: { ...process.env, RESOURCE_MAP_ENGINE_DIR: engineDir },
        }
      )
      expect(readJsonl(output)).toHaveLength(2)
      writeFileSync(
        registry,
        [
          {
            sourceId: "source-a",
            slug: "source-a",
            name: "Source A Renamed",
            connectorType: "json",
            sourceType: "api",
            trustLevel: "official",
            rawUrl: sourceA,
          },
          {
            sourceId: "source-b",
            slug: "source-b",
            name: "Source B",
            connectorType: "json",
            sourceType: "api",
            trustLevel: "official",
            rawUrl: sourceB,
          },
        ]
          .map((source) => JSON.stringify(source))
          .join("\n")
      )

      writeFileSync(
        sourceA,
        JSON.stringify([
          {
            sourceRecordId: "record-a",
            organizationName: "Updated Pantry",
            title: "Updated Pantry",
            category: "Food Pantry",
            latitude: 41.88,
            longitude: -87.63,
          },
        ])
      )
      const retryOutput = execFileSync(
        process.execPath,
        [
          INGEST,
          "--registry",
          registry,
          "--source",
          "source-a",
          "--write",
          "--output",
          output,
        ],
        {
          cwd: ROOT,
          encoding: "utf8",
          env: { ...process.env, RESOURCE_MAP_ENGINE_DIR: engineDir },
        }
      )
      const candidates = readJsonl(output)

      expect(retryOutput).toContain("(2 total)")
      expect(candidates).toHaveLength(2)
      expect(candidates).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            sourceId: "source-a",
            sourceRecordId: "record-a",
            extractedFields: expect.objectContaining({
              title: "Updated Pantry",
            }),
          }),
          expect.objectContaining({
            sourceId: "source-b",
            sourceRecordId: "record-b",
            extractedFields: expect.objectContaining({
              title: "Community Clinic",
            }),
          }),
        ])
      )
      execFileSync(
        process.execPath,
        [
          INGEST,
          "--registry",
          registry,
          "--source",
          "source-a",
          "--write",
          "--output",
          output,
        ],
        {
          cwd: ROOT,
          encoding: "utf8",
          env: { ...process.env, RESOURCE_MAP_ENGINE_DIR: engineDir },
        }
      )
      const rawPayloads = readJsonl(join(engineDir, "raw-payloads.jsonl"))
      expect(
        rawPayloads
          .filter((raw) => raw.source_id === "source-a")
          .map((raw) => raw.fetch_status)
      ).toEqual(["fetched", "fetched"])

      writeFileSync(sourceA, JSON.stringify([]))
      execFileSync(
        process.execPath,
        [
          INGEST,
          "--registry",
          registry,
          "--source",
          "source-a",
          "--replace-source-candidates",
          "--write",
          "--output",
          output,
        ],
        {
          cwd: ROOT,
          encoding: "utf8",
          env: { ...process.env, RESOURCE_MAP_ENGINE_DIR: engineDir },
        }
      )
      const replacedCandidates = readJsonl(output)
      expect(replacedCandidates).toHaveLength(1)
      expect(replacedCandidates[0]).toMatchObject({
        sourceId: "source-b",
        sourceRecordId: "record-b",
      })
    })
  }, 30_000)

  it("encodes explicit OSM Overpass and Wikidata SPARQL connector queries", async () => {
    const { buildConnectorHttpRequest, buildDerivedConnectorUrl } =
      await import(pathToFileURL(CONNECTORS).href)
    const overpassUrl = new URL(
      buildDerivedConnectorUrl({
        connectorType: "osm_overpass",
        rawUrl: "https://overpass-api.de/api/interpreter",
        overpassQuery:
          '[out:json][timeout:25];node["amenity"="food_bank"](41.6,-88,42,-87.4);out center;',
      })
    )
    const wikidataUrl = new URL(
      buildDerivedConnectorUrl({
        connectorType: "wikidata_sparql",
        rawUrl: "https://query.wikidata.org/sparql",
        sparqlQuery:
          'SELECT ?item ?itemLabel WHERE { ?item wdt:P31 wd:Q7075 . SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } LIMIT 10',
      })
    )

    expect(overpassUrl.searchParams.get("data")).toContain(
      'amenity"="food_bank'
    )
    expect(wikidataUrl.searchParams.get("format")).toBe("json")
    expect(wikidataUrl.searchParams.get("query")).toContain("SELECT ?item")

    const arcgisUrl = new URL(
      buildDerivedConnectorUrl({
        connectorType: "arcgis",
        rawUrl:
          "https://services.arcgis.com/example/arcgis/rest/services/Cooling_Centers/FeatureServer/0",
      })
    )
    expect(arcgisUrl.pathname).toContain("/FeatureServer/0/query")
    expect(arcgisUrl.searchParams.get("where")).toBe("1=1")
    expect(arcgisUrl.searchParams.get("outFields")).toBe("*")
    expect(arcgisUrl.searchParams.get("returnGeometry")).toBe("true")
    expect(arcgisUrl.searchParams.get("outSR")).toBe("4326")

    const longQueryRequest = buildConnectorHttpRequest({
      connectorType: "wikidata_sparql",
      rawUrl: "https://query.wikidata.org/sparql",
      sparqlQuery: `SELECT ?item WHERE { ${"?item wdt:P31 wd:Q7075 . ".repeat(
        100
      )} } LIMIT 10`,
    })
    const forcedOverpassPost = buildConnectorHttpRequest({
      connectorType: "osm_overpass",
      rawUrl: "https://overpass-api.de/api/interpreter",
      fetchMethod: "POST",
      overpassQuery:
        '[out:json][timeout:25];node["amenity"="food_bank"](41.6,-88,42,-87.4);out center;',
    })

    expect(longQueryRequest).toMatchObject({
      method: "POST",
      url: "https://query.wikidata.org/sparql",
    })
    expect(longQueryRequest.body).toContain("format=json")
    expect(forcedOverpassPost).toMatchObject({
      method: "POST",
      url: "https://overpass-api.de/api/interpreter",
    })
    expect(forcedOverpassPost.body).toContain("data=")
  })

  it("normalizes common textual hours and availability labels", async () => {
    const { normalizeCandidateRecord } = await import(
      pathToFileURL(NORMALIZER).href
    )
    const twentyFourSeven = normalizeCandidateRecord({
      sourceRecordId: "hours-24-7",
      sourceUrl: "https://hours.example.org",
      extractedFields: {
        organizationName: "Crisis Hotline",
        title: "Crisis hotline",
        category: "Crisis & Hotlines",
        hours: "24/7",
        websiteUrl: "https://hours.example.org",
      },
    })
    const appointmentOnly = normalizeCandidateRecord({
      sourceRecordId: "hours-appointment",
      sourceUrl: "https://appointments.example.org",
      extractedFields: {
        organizationName: "Appointment Clinic",
        title: "Counseling appointments",
        category: "Mental Health",
        hours: "By appointment only",
        websiteUrl: "https://appointments.example.org",
      },
    })
    const librarySchedule = normalizeCandidateRecord({
      sourceRecordId: "hours-library",
      sourceUrl: "https://www.chipublib.org/locations/3/",
      extractedFields: {
        organizationName: "Chicago Public Library",
        title: "Albany Park Branch Library",
        category: "Libraries",
        hours:
          "Mon. & Wed., 10-6; Tues. & Thurs., Noon-8; Fri. & Sat., 9-5; Sun., 1-5",
        websiteUrl: "https://www.chipublib.org/locations/3/",
      },
    })
    const staleLibrarySchedule = normalizeCandidateRecord({
      sourceRecordId: "hours-library-stale",
      sourceUrl: "https://www.chipublib.org/locations/3/",
      extractedFields: {
        organizationName: "Chicago Public Library",
        title: "Albany Park Branch Library",
        category: "Libraries",
        hours: {
          label:
            "Mon. & Wed., 10-6; Tues. & Thurs., Noon-8; Fri. & Sat., 9-5; Sun., 1-5",
          weekly: [
            {
              days: ["tuesday", "thursday"],
              opensAt: "12:00",
              closesAt: "08:00",
            },
          ],
        },
        websiteUrl: "https://www.chipublib.org/locations/3/",
      },
    })

    expect(twentyFourSeven.extractedFields.hours).toMatchObject({
      label: "24/7",
      weekly: [
        {
          days: [
            "monday",
            "tuesday",
            "wednesday",
            "thursday",
            "friday",
            "saturday",
            "sunday",
          ],
          opensAt: "00:00",
          closesAt: "24:00",
        },
      ],
    })
    expect(twentyFourSeven.extractedFields.availabilityStatus).toBe("available")
    expect(appointmentOnly.extractedFields).toMatchObject({
      appointmentRequired: true,
      availabilityStatus: "appointment_only",
    })
    expect(librarySchedule.extractedFields.hours.weekly).toEqual([
      {
        days: ["monday", "wednesday"],
        opensAt: "10:00",
        closesAt: "18:00",
      },
      {
        days: ["tuesday", "thursday"],
        opensAt: "12:00",
        closesAt: "20:00",
      },
      {
        days: ["friday", "saturday"],
        opensAt: "09:00",
        closesAt: "17:00",
      },
      {
        days: ["sunday"],
        opensAt: "13:00",
        closesAt: "17:00",
      },
    ])
    expect(staleLibrarySchedule.extractedFields.hours.weekly).toEqual(
      librarySchedule.extractedFields.hours.weekly
    )
    const finderOpen = normalizeCandidateRecord({
      sourceRecordId: "nyc-finder-open",
      sourceUrl: "https://finder.nyc.gov/coolingcenters/locations?mView=map",
      extractedFields: {
        organizationName: "Petco Turtle Bay",
        title: "Petco Turtle Bay",
        category: "Cooling Centers",
        availabilityStatus: "OPEN",
        latitude: 40.7565,
        longitude: -73.9677,
      },
    })
    const finderClosed = normalizeCandidateRecord({
      sourceRecordId: "nyc-finder-closed",
      sourceUrl: "https://finder.nyc.gov/coolingcenters/locations?mView=map",
      extractedFields: {
        organizationName: "Spray Shower",
        title: "Spray Shower",
        category: "Cooling Centers",
        availabilityStatus: "CLOSED",
        latitude: 40.7565,
        longitude: -73.9677,
      },
    })

    expect(finderOpen.extractedFields.availabilityStatus).toBe("available")
    expect(finderClosed.extractedFields.availabilityStatus).toBe("closed")
    expect(
      appointmentOnly.extractedFields.normalization.warnings
    ).not.toContain("hours_unparseable")
  })

  it("parses Fridge Finder community fridge rows with nested location and status", async () => {
    const { parseRawPayload } = await import(pathToFileURL(PARSERS).href)
    const { normalizeCandidateRecord } = await import(
      pathToFileURL(NORMALIZER).href
    )
    const parsed = parseRawPayload(
      {
        raw_url: "https://api-prod.communityfridgefinder.com/v1/fridges/",
        raw_text: JSON.stringify([
          {
            id: "livinggallery",
            name: "Living Gallery",
            location: {
              street: "1094 Broadway",
              city: "Brooklyn",
              state: "NY",
              zip: "11221",
              geoLat: 40.694207,
              geoLng: -73.930599,
            },
            maintainer: {
              instagram: "https://www.instagram.com/the_living_gallery",
            },
            last_edited: "1667513900",
            latestFridgeReport: {
              fridgeId: "livinggallery",
              timestamp: "2026-04-03T19:31:56Z",
              condition: "not at location",
              foodPercentage: 0,
              notes: "Fridge is temporarily removed.",
            },
          },
        ]),
        content_type: "application/json",
        fetched_at: "2026-07-02T18:00:00.000Z",
      },
      {
        sourceId: "nyc-fridgefinder-community-fridges",
        name: "Fridge Finder - Community Fridges",
        connectorType: "json",
        sourceType: "api",
        sourceCategoryText: "Community Fridges",
      }
    )
    const normalized = normalizeCandidateRecord(parsed.records[0])

    expect(parsed.warnings).toEqual([])
    expect(parsed.records[0]).toMatchObject({
      sourceRecordId: "livinggallery",
      sourceUrl: "https://www.fridgefinder.app/fridge/livinggallery",
    })
    expect(normalized.extractedFields).toMatchObject({
      organizationName: "Living Gallery",
      title: "Living Gallery",
      sourceCategoryText: "Community Fridges",
      address: "1094 Broadway",
      city: "Brooklyn",
      state: "NY",
      postalCode: "11221",
      latitude: 40.694207,
      longitude: -73.930599,
      websiteUrl: "https://www.instagram.com/the_living_gallery",
      availabilityStatus: "closed",
      primaryResourceCategory: "food_community_fridges",
    })
    expect(normalized.extractedFields.resourceCategories).toEqual(
      expect.arrayContaining(["food_community_fridges", "food"])
    )
  })

  it("keeps OSM amenity tags out of public descriptions", async () => {
    const { parseRawPayload } = await import(pathToFileURL(PARSERS).href)
    const parsed = parseRawPayload(
      {
        raw_url: "https://overpass-api.de/api/interpreter",
        raw_text: JSON.stringify({
          elements: [
            {
              type: "way",
              id: 145257059,
              center: { lat: 41.799, lon: -87.593 },
              tags: {
                name: "Hyde Park Neighborhood Club",
                amenity: "community_centre",
                "addr:housenumber": "5480",
                "addr:street": "South Kenwood Avenue",
                "addr:city": "Chicago",
                "addr:state": "IL",
              },
            },
          ],
        }),
        content_type: "application/json",
        fetched_at: "2026-07-06T17:00:00.000Z",
      },
      {
        sourceId: "chicago-osm-community-libraries",
        name: "OpenStreetMap - Chicago libraries and community centers",
        connectorType: "osm_overpass",
        sourceType: "api",
      }
    )

    expect(parsed.records).toHaveLength(1)
    expect(parsed.records[0]?.extractedFields).toMatchObject({
      organizationName: "Hyde Park Neighborhood Club",
      title: "Hyde Park Neighborhood Club",
      sourceCategoryText: "community_centre",
      address: "5480 South Kenwood Avenue",
      city: "Chicago",
      state: "IL",
    })
    expect(parsed.records[0]?.extractedFields.description).toBeNull()
  })

  it("preserves uncertain duplicate candidates for review", async () => {
    const { dedupeRecords } = await import(pathToFileURL(DEDUPE).href)
    const result = dedupeRecords([
      {
        sourceId: "source-a",
        sourceRecordId: "record-a",
        normalizedName: "northside clinic",
        normalizedDomain: "clinic.example.org",
        normalizedPhone: "+13125550100",
        extractedFields: {
          title: "Northside Clinic",
          phone: "312-555-0100",
          email: "north@clinic.example.org",
        },
      },
      {
        sourceId: "source-b",
        sourceRecordId: "record-b",
        normalizedName: "westside clinic",
        normalizedDomain: "clinic.example.org",
        normalizedPhone: "+13125550100",
        extractedFields: {
          title: "Westside Clinic",
          phone: "312-555-0100",
          email: "west@clinic.example.org",
        },
      },
    ])

    expect(result.preservedRecords).toHaveLength(2)
    expect(result.duplicates).toEqual([
      expect.objectContaining({
        sourceRecordId: "record-b",
        duplicateOf: "record-a",
        confidence: 60,
        reviewNeeded: true,
        conflicts: expect.arrayContaining(["email", "title"]),
      }),
    ])
    expect(result.preservedRecords[1]).toMatchObject({
      duplicateMatchStatus: "candidate",
      extractedFields: {
        dedupe: expect.objectContaining({
          status: "candidate",
          duplicateConfidence: 60,
          reviewNeeded: true,
        }),
      },
    })
  })

  it("keeps same-place distinct services as duplicate candidates, not hard duplicates", async () => {
    const { dedupeRecords } = await import(pathToFileURL(DEDUPE).href)
    const result = dedupeRecords([
      {
        sourceId: "source-a",
        sourceRecordId: "library-internet",
        normalizedName: "main library",
        normalizedDomain: "library.example.org",
        normalizedPhone: "+13125550100",
        normalizedAddress: "1 main st chicago il",
        extractedFields: {
          title: "Free internet access",
          description: "Computers and Wi-Fi for public use.",
          category: "community",
          primaryResourceCategory: "community_internet_access",
          resourceCategories: ["community", "community_internet_access"],
          phone: "312-555-0100",
          websiteUrl: "https://library.example.org",
          latitude: 41.88,
          longitude: -87.63,
        },
      },
      {
        sourceId: "source-b",
        sourceRecordId: "library-cooling",
        normalizedName: "main library",
        normalizedDomain: "library.example.org",
        normalizedPhone: "+13125550100",
        normalizedAddress: "1 main st chicago il",
        extractedFields: {
          title: "Cooling center",
          description: "Temporary cooling space during high heat.",
          category: "emergency",
          primaryResourceCategory: "emergency_cooling_centers",
          resourceCategories: ["emergency", "emergency_cooling_centers"],
          phone: "312-555-0100",
          websiteUrl: "https://library.example.org",
          latitude: 41.88,
          longitude: -87.63,
        },
      },
    ])

    expect(result.canonicalRecords).toHaveLength(2)
    expect(result.preservedRecords).toHaveLength(2)
    expect(result.duplicates).toEqual([
      expect.objectContaining({
        sourceRecordId: "library-cooling",
        duplicateOf: "library-internet",
        confidence: 82,
        reviewNeeded: true,
        reasons: expect.arrayContaining(["different_service"]),
        conflicts: expect.arrayContaining(["title", "description", "category"]),
      }),
    ])
    expect(result.preservedRecords[1]).toMatchObject({
      duplicateMatchStatus: "candidate",
      extractedFields: {
        dedupe: expect.objectContaining({
          status: "candidate",
          duplicateConfidence: 82,
          reviewNeeded: true,
        }),
      },
    })
  })

  it("maps canonical Coach House taxonomy labels across all top-level groups", async () => {
    const { classifyResourceTaxonomy } = await import(
      pathToFileURL(TAXONOMY_CLASSIFIER).href
    )
    const cases = [
      ["Women's Health", "health", "health_womens_health"],
      ["Baby Formula", "food", "food_baby_formula"],
      [
        "Permanent Supportive Housing",
        "housing",
        "housing_permanent_supportive_housing",
      ],
      ["College Access", "education", "education_college_access"],
      ["Apprenticeships", "employment", "employment_apprenticeships"],
      ["Debt Counseling", "finance", "finance_debt_counseling"],
      ["Housing Law", "legal", "legal_housing_law"],
      ["Veterans", "family", "family_veterans"],
      ["Faith Organizations", "faith", "community_faith_organizations"],
      [
        "Disaster Preparedness",
        "emergency",
        "emergency_emergency_preparedness",
      ],
      [
        "Environmental Justice",
        "environment",
        "environment_environmental_justice",
      ],
      ["Human Trafficking", "safety", "safety_human_trafficking"],
      ["Capacity Building", "organizations", "organizations_capacity_building"],
      ["Humanitarian Aid", "international", "international_humanitarian_aid"],
      ["Animal Welfare", "animals", "animals_animal_welfare"],
    ] as const

    for (const [label, parentCategory, expectedCategory] of cases) {
      const result = classifyResourceTaxonomy({
        extractedFields: {
          sourceCategoryText: label,
          title: `${label} resource`,
          description: `Local ${label.toLowerCase()} support.`,
        },
      })

      expect(result.resourceCategories).toEqual(
        expect.arrayContaining([parentCategory, expectedCategory])
      )
      expect(result.categories).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            category: expectedCategory,
            categoryGroup: parentCategory,
          }),
        ])
      )
      expect(result.unmatchedTerms).not.toContain(label)
    }

    const libraryCategory = classifyResourceTaxonomy({
      extractedFields: {
        sourceCategoryText: "Cooling Centers; Public Library",
        title: "Neighborhood library",
      },
    })
    expect(libraryCategory.primaryResourceCategory).toBe("community_libraries")
    expect(libraryCategory.resourceCategories).toEqual(
      expect.arrayContaining(["community", "community_libraries"])
    )
    expect(libraryCategory.resourceCategories).not.toEqual(
      expect.arrayContaining(["emergency"])
    )
    expect(libraryCategory.resourceCategories).not.toEqual(
      expect.arrayContaining(["emergency_cooling_centers"])
    )

    const officialSourceLibrary = classifyResourceTaxonomy({
      sourceName: "Official Cooling Centers",
      sourceUrl: "https://city.example.gov/cooling-centers",
      extractedFields: {
        sourceCategoryText: "Cooling Centers; Public Library",
        title: "Neighborhood library",
      },
    })
    expect(officialSourceLibrary.primaryResourceCategory).toBe(
      "emergency_cooling_centers"
    )
    expect(officialSourceLibrary.resourceCategories).not.toEqual(
      expect.arrayContaining(["emergency"])
    )
    expect(officialSourceLibrary.resourceCategories).toEqual(
      expect.arrayContaining(["environment", "emergency_cooling_centers"])
    )

    const coolingCenter = classifyResourceTaxonomy({
      extractedFields: {
        sourceCategoryText: "Cooling Centers; Public Library",
        title: "Neighborhood Library Cooling Center",
      },
    })
    expect(coolingCenter.primaryResourceCategory).toBe(
      "emergency_cooling_centers"
    )
    expect(coolingCenter.resourceCategories).toEqual(
      expect.arrayContaining(["environment", "emergency_cooling_centers"])
    )
    expect(coolingCenter.resourceCategories).not.toContain("emergency")
    expect(coolingCenter.flags).not.toContain("ambiguous_top_match")
    expect(coolingCenter.needsReview).toBe(false)

    expect(
      classifyResourceTaxonomy({
        extractedFields: { sourceCategoryText: "womens_health" },
      }).resourceCategories
    ).toEqual(expect.arrayContaining(["health", "health_womens_health"]))

    const typoCategory = classifyResourceTaxonomy({
      extractedFields: {
        sourceCategoryText: "Food Pantriez",
      },
    })
    expect(typoCategory.primaryResourceCategory).toBe("food_food_pantries")
    expect(typoCategory.resourceCategories).toEqual(
      expect.arrayContaining(["food", "food_food_pantries"])
    )
    expect(typoCategory.matchedTerms).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          matchType: "fuzzy_edit",
          matchedAlias: "food pantries",
        }),
      ])
    )
    expect(typoCategory.flags).toContain("fuzzy_match")
    expect(typoCategory.needsReview).toBe(true)

    const typoHealth = classifyResourceTaxonomy({
      extractedFields: {
        category: "Dentel",
      },
    })
    expect(typoHealth.resourceCategories).toEqual(
      expect.arrayContaining(["health", "health_dental"])
    )
    expect(typoHealth.matchedTerms).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          matchType: "fuzzy_edit",
          matchedAlias: "dental",
        }),
      ])
    )
  })

  it("builds data-quality flags from link-check evidence", async () => {
    const { buildQualityFlags } = await import(pathToFileURL(QUALITY).href)
    const result = buildQualityFlags(
      {
        sourceRecordId: "quality-link-check",
        normalizedPhone: "3125550100",
        lastSeenAt: new Date().toISOString(),
        extractedFields: {
          category: "Food Pantries",
          address: "100 Pantry Ave, Chicago, IL 60601",
          eligibility: "Open to local residents.",
          websiteUrl: "https://pantry.example.org",
          linkChecks: [
            {
              url: "https://pantry.example.org/old-intake",
              status: 404,
              ok: false,
              reason: "http_status_not_ok",
            },
          ],
        },
      },
      {
        sourceType: "api",
        trustLevel: "partner",
        publicDisplayAllowed: true,
      }
    )

    expect(result.flagCodes).toContain("broken_url")
    expect(result.scoring.reasonCodes).toContain("broken_links")
    expect(result.flags).toContainEqual(
      expect.objectContaining({
        code: "broken_url",
        severity: "review",
      })
    )
    expect(result.needsReview).toBe(true)
  })

  it("keeps unverified structured sources in review even with contact and recent fetch", async () => {
    const { buildQualityFlags } = await import(pathToFileURL(QUALITY).href)
    const result = buildQualityFlags(
      {
        sourceRecordId: "weak-source-record",
        normalizedDomain: "unknown-directory.example.org",
        normalizedPhone: "+13125550100",
        confidenceScore: 92,
        lastSeenAt: new Date().toISOString(),
        extractedFields: {
          category: "Food Pantries",
          address: "100 Pantry Ave, Chicago, IL 60601",
          eligibility: "Open to local residents.",
          websiteUrl: "https://unknown-directory.example.org/pantry",
        },
      },
      {
        connectorType: "json",
        sourceType: "api",
      }
    )

    expect(result.scoring.trustScore).toBeLessThan(65)
    expect(result.scoring.reasonCodes).toEqual(
      expect.arrayContaining([
        "structured_source_unverified",
        "has_website_domain",
        "has_contact",
        "recent_fetch",
      ])
    )
    expect(result.flagCodes).toContain("low_trust")
    expect(result.needsReview).toBe(true)
  })

  it("classifies service-area-only resources without point geocoding", async () => {
    const { geocodeRecord } = await import(pathToFileURL(GEOCODER).href)
    const { buildQualityFlags } = await import(pathToFileURL(QUALITY).href)
    const geocoded = await geocodeRecord(
      {
        sourceRecordId: "service-area-only",
        normalizedPhone: "3125550123",
        lastSeenAt: new Date().toISOString(),
        extractedFields: {
          organizationName: "Regional Benefits Navigator",
          title: "Benefits enrollment hotline",
          category: "Benefits Enrollment",
          serviceArea: ["Cook County", "DuPage County"],
          websiteUrl: "https://benefits.example.org",
          eligibility: "Illinois residents in listed service areas.",
        },
      },
      { network: false }
    )
    const quality = buildQualityFlags(geocoded, {
      sourceType: "api",
      trustLevel: "partner",
      publicDisplayAllowed: true,
    })

    expect(geocoded.extractedFields).toMatchObject({
      locationType: "service_area",
      serviceArea: ["Cook County", "DuPage County"],
      geocodingAccuracy: "service_area_only",
      geocodingConfidence: 85,
    })
    expect(geocoded.fieldEvidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldPath: "extractedFields.geocodingAccuracy",
          fieldValue: "service_area_only",
          transformation: "classify_service_area_only_location",
        }),
      ])
    )
    expect(quality.flagCodes).toContain("service_area_only")
    expect(quality.flagCodes).not.toContain("missing_address")
    expect(quality.flagCodes).not.toContain("geocode_unattempted")
    expect(quality.flagCodes).not.toContain("bad_geocode")
  })

  it("does not penalize online or service-area resources for missing point addresses", async () => {
    const { normalizeCandidateRecord } = await import(
      pathToFileURL(NORMALIZER).href
    )
    const online = normalizeCandidateRecord({
      sourceRecordId: "online-resource",
      sourceUrl: "https://digital.example.org",
      extractedFields: {
        organizationName: "Digital Access Desk",
        title: "Online device navigation",
        category: "Device Access",
        locationType: "online",
        websiteUrl: "https://digital.example.org",
      },
    })
    const serviceArea = normalizeCandidateRecord({
      sourceRecordId: "service-area-resource",
      sourceUrl: "https://navigator.example.org",
      extractedFields: {
        organizationName: "Regional Navigator",
        title: "Regional benefits navigation",
        category: "Benefits Enrollment",
        serviceArea: ["Cook County"],
        websiteUrl: "https://navigator.example.org",
      },
    })

    expect(online.extractedFields).toMatchObject({
      locationType: "online",
      onlineOnly: false,
    })
    expect(online.extractedFields.normalization.missingFlags).not.toContain(
      "missing_address"
    )
    expect(serviceArea.extractedFields).toMatchObject({
      locationType: null,
      serviceArea: ["Cook County"],
    })
    expect(
      serviceArea.extractedFields.normalization.missingFlags
    ).not.toContain("missing_address")
  })

  it("removes invalid source coordinates before map preparation", async () => {
    const { geocodeRecord } = await import(pathToFileURL(GEOCODER).href)
    const { buildQualityFlags } = await import(pathToFileURL(QUALITY).href)
    const geocoded = await geocodeRecord(
      {
        sourceRecordId: "invalid-coordinates",
        normalizedPhone: "+13125550100",
        lastSeenAt: new Date().toISOString(),
        extractedFields: {
          organizationName: "Bad Point Pantry",
          title: "Food pantry",
          category: "Food Pantry",
          address: "10 Main St",
          city: "Chicago",
          state: "IL",
          latitude: 999,
          longitude: -999,
          phone: "312-555-0100",
        },
      },
      { network: false }
    )
    const quality = buildQualityFlags(geocoded, {
      sourceType: "api",
      trustLevel: "partner",
      publicDisplayAllowed: true,
    })

    expect(geocoded.extractedFields).toMatchObject({
      latitude: null,
      longitude: null,
      geocodingAccuracy: "invalid_source_coordinates",
      geocodingConfidence: 0,
    })
    expect(geocoded.fieldEvidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldPath: "extractedFields.geocodingAccuracy",
          fieldValue: "invalid_source_coordinates",
          transformation: "validate_source_coordinates",
        }),
      ])
    )
    expect(quality.flagCodes).toContain("bad_geocode")
  })

  it("rejects Census results that ignore the requested postal code", async () => {
    const { selectCensusAddressMatch } = await import(
      pathToFileURL(GEOCODER).href
    )
    const match = selectCensusAddressMatch(
      "475 Riverside Dr, Suite 700, New York, NY 10115",
      [
        {
          addressComponents: {
            city: "RIVERHEAD",
            state: "NY",
            zip: "11901",
          },
          coordinates: { x: -72.6413885, y: 40.9204628 },
          matchedAddress: "475 RIVERSIDE DR, RIVERHEAD, NY, 11901",
        },
      ]
    )

    expect(match).toBeNull()
  })

  it("bounds network geocoding failures and records provider errors", async () => {
    const { geocodeRecord } = await import(pathToFileURL(GEOCODER).href)
    const geocoded = await geocodeRecord(
      {
        sourceRecordId: "network-geocode-timeout",
        sourceUrl: "https://city.example.gov/resource",
        extractedFields: {
          organizationName: "Timeout Pantry",
          title: "Timeout Pantry",
          category: "Food Pantries",
          address: "100 Timeout Ave",
          city: "Chicago",
          state: "IL",
          postalCode: "60601",
        },
      },
      {
        network: true,
        geocodeTimeoutMs: 10,
        geocodeProviderDelayMs: 0,
        geocoders: [
          {
            name: "census",
            geocode: () => new Promise(() => {}),
          },
          {
            name: "nominatim",
            geocode: () => {
              throw new Error("fixture provider failed")
            },
          },
        ],
      }
    )

    expect(geocoded.extractedFields).toMatchObject({
      geocodingAccuracy: "failed",
      geocodingConfidence: 0,
      geocodingErrors: [
        expect.objectContaining({
          provider: "census",
          message: expect.stringContaining("timed out"),
        }),
        expect.objectContaining({
          provider: "nominatim",
          message: "fixture provider failed",
        }),
      ],
    })
    expect(geocoded.fieldEvidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldPath: "extractedFields.geocodingErrors",
          transformation: "geocode_provider_errors",
        }),
      ])
    )
  })

  it("parses Atom feed entries with attribute links and categories", async () => {
    const { parseRawPayload } = await import(pathToFileURL(PARSERS).href)
    const parsed = parseRawPayload(
      {
        raw_url: "https://resources.example.org/feed.atom",
        raw_text: [
          '<?xml version="1.0" encoding="utf-8"?>',
          '<feed xmlns="http://www.w3.org/2005/Atom">',
          "<entry>",
          "<id>tag:resources.example.org,2026:pantry-1</id>",
          "<title>Neighborhood pantry intake</title>",
          "<summary>Fresh groceries and benefits navigation.</summary>",
          '<link rel="alternate" href="https://resources.example.org/pantry" />',
          '<category term="Food Pantries" />',
          "<updated>2026-06-28T12:00:00Z</updated>",
          "</entry>",
          "</feed>",
        ].join(""),
        content_type: "application/atom+xml",
        fetched_at: "2026-06-28T12:30:00.000Z",
      },
      {
        sourceId: "fixture-atom",
        name: "Fixture Atom feed",
        connectorType: "rss_atom",
        sourceType: "scrape",
      }
    )
    const [record] = parsed.records

    expect(parsed.warnings).toEqual([])
    expect(record.sourceRecordId).toBe(
      "tag:resources.example.org,2026:pantry-1"
    )
    expect(record.sourceUrl).toBe("https://resources.example.org/pantry")
    expect(record.extractedFields).toMatchObject({
      title: "Neighborhood pantry intake",
      description: "Fresh groceries and benefits navigation.",
      sourceCategoryText: "Food Pantries",
      websiteUrl: "https://resources.example.org/pantry",
      sourceUrl: "https://resources.example.org/pantry",
    })
    expect(record.lastUpdatedAt).toBe("2026-06-28T12:00:00Z")
    expect(record.fieldEvidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldPath: "extractedFields.websiteUrl",
          fieldValue: "https://resources.example.org/pantry",
        }),
        expect.objectContaining({
          fieldPath: "extractedFields.sourceCategoryText",
          fieldValue: "Food Pantries",
        }),
      ])
    )
  })

  it("parses Socrata nested website and location fields from civic datasets", async () => {
    const { parseRawPayload } = await import(pathToFileURL(PARSERS).href)
    const { normalizeCandidateRecord } = await import(
      pathToFileURL(NORMALIZER).href
    )
    const parsed = parseRawPayload(
      {
        raw_url:
          "https://data.cityofchicago.org/resource/x8fc-8rcq.json?$limit=1",
        raw_text: JSON.stringify([
          {
            branch_: "Albany Park",
            service_hours:
              "Mon. & Wed., 10-6; Tues. & Thurs., Noon-8; Fri. & Sat., 9-5; Sun., 1-5",
            address: "3401 W. Foster Ave.",
            city: "Chicago",
            state: "IL",
            zip: "60625",
            phone: "(773) 539-5450",
            website: { url: "https://www.chipublib.org/locations/3/" },
            branch_email: "albanypark@chipublib.org",
            location: {
              latitude: "41.97557881655979",
              longitude: "-87.71361314512697",
            },
          },
        ]),
        content_type: "application/json",
        fetched_at: "2026-06-30T04:00:00.000Z",
      },
      {
        sourceId: "chicago-socrata-libraries",
        name: "Chicago Data Portal - Libraries",
        connectorType: "socrata",
        sourceType: "api",
        sourceCategoryText: "Libraries",
      }
    )
    const normalized = normalizeCandidateRecord(parsed.records[0])

    expect(parsed.warnings).toEqual([])
    expect(parsed.records).toHaveLength(1)
    expect(parsed.records[0].sourceRecordId).toBe("Albany Park")
    expect(normalized.extractedFields).toMatchObject({
      organizationName: "Albany Park",
      title: "Albany Park",
      sourceCategoryText: "Libraries",
      address: "3401 W. Foster Ave.",
      city: "Chicago",
      state: "IL",
      postalCode: "60625",
      latitude: 41.97557881655979,
      longitude: -87.71361314512697,
      email: "albanypark@chipublib.org",
      websiteUrl: "https://www.chipublib.org/locations/3",
      primaryResourceCategory: "community_libraries",
    })
    expect(normalized.extractedFields.resourceCategories).toEqual(
      expect.arrayContaining(["community_libraries", "community"])
    )
    expect(normalized.fieldEvidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldPath: "extractedFields.websiteUrl",
          fieldValue: "https://www.chipublib.org/locations/3",
        }),
        expect.objectContaining({
          fieldPath: "extractedFields.latitude",
          fieldValue: 41.97557881655979,
        }),
      ])
    )
  })

  it("keeps source evidence when normalized fields add derived evidence", async () => {
    const { normalizeCandidateRecord } = await import(
      pathToFileURL(NORMALIZER).href
    )
    const normalized = normalizeCandidateRecord({
      sourceRecordId: "provenance-url",
      sourceUrl: "https://city.example.gov/dataset",
      extractedFields: {
        organizationName: "City Pantry",
        title: "City Pantry",
        category: "Food Pantries",
        websiteUrl: "www.citypantry.example.org/intake?utm_source=catalog",
      },
      fieldEvidence: [
        {
          fieldPath: "extractedFields.websiteUrl",
          fieldValue: "www.citypantry.example.org/intake?utm_source=catalog",
          confidenceScore: 75,
          sourceUrl: "https://city.example.gov/dataset",
          observedAt: "2026-06-30T12:00:00.000Z",
          evidenceType: "source",
          derivedFrom: [],
          transformation: null,
        },
      ],
    })

    expect(normalized.extractedFields.websiteUrl).toBe(
      "https://www.citypantry.example.org/intake"
    )
    expect(normalized.fieldEvidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldPath: "extractedFields.websiteUrl",
          fieldValue: "www.citypantry.example.org/intake?utm_source=catalog",
          evidenceType: "source",
          transformation: null,
        }),
        expect.objectContaining({
          fieldPath: "extractedFields.websiteUrl",
          fieldValue: "https://www.citypantry.example.org/intake",
          evidenceType: "derived",
          transformation: "normalize_url",
          derivedFrom: ["extractedFields.websiteUrl"],
        }),
      ])
    )
  })

  it("parses official cooling-center Socrata facility aliases", async () => {
    const { parseRawPayload } = await import(pathToFileURL(PARSERS).href)
    const { normalizeCandidateRecord } = await import(
      pathToFileURL(NORMALIZER).href
    )
    const parsed = parseRawPayload(
      {
        raw_url:
          "https://data.cityofchicago.org/resource/msrk-w9ih.json?$limit=2",
        raw_text: JSON.stringify([
          {
            site_type: "Chicago Community College",
            site_name: "Daley College",
            hours_of_operation: "M-F 8am-8pm; Sat 9am-3pm; Closed Sun",
            address: "7500 S. Pulaski",
            city: "Chicago",
            state: "IL",
            zip: "60652",
            phone: "773-838-7500",
            location: {
              type: "Point",
              coordinates: [-87.72219, 41.75731],
            },
          },
          {
            name: "Barrington Main Train Station",
            streetaddress: "201 S. Spring St.",
            city: "BARRINGTON",
            hours_of_operation: "Monday - Friday 6:00 a.m. - 10:00 p.m.",
            contactphone: "(847) 304-3400",
            latitude: "42.15260812778155",
            longitude: "-88.13330407405007",
          },
        ]),
        content_type: "application/json",
        fetched_at: "2026-06-30T12:00:00.000Z",
      },
      {
        sourceId: "fixture-socrata-cooling-centers",
        name: "Fixture Cooling Centers",
        connectorType: "socrata",
        sourceType: "api",
        sourceCategoryText: "Cooling Centers",
      }
    )
    const first = normalizeCandidateRecord(parsed.records[0])
    const second = normalizeCandidateRecord(parsed.records[1])

    expect(parsed.warnings).toEqual([])
    expect(
      new Set(
        parsed.records.map(
          (record: { sourceRecordId: string }) => record.sourceRecordId
        )
      ).size
    ).toBe(2)
    expect(parsed.records[0].sourceRecordId).toMatch(/^[a-f0-9]{32}$/u)
    expect(parsed.records[1].sourceRecordId).toMatch(/^[a-f0-9]{32}$/u)
    expect(first.extractedFields).toMatchObject({
      organizationName: "Daley College",
      title: "Daley College",
      sourceCategoryText: "Cooling Centers; Chicago Community College",
      address: "7500 S. Pulaski",
      city: "Chicago",
      state: "IL",
      postalCode: "60652",
      latitude: 41.75731,
      longitude: -87.72219,
      phone: "773-838-7500",
      normalizedPhone: "+17738387500",
      primaryResourceCategory: "emergency_cooling_centers",
    })
    expect(first.extractedFields.resourceCategories).toEqual(
      expect.arrayContaining([
        "emergency_cooling_centers",
        "environment",
        "education",
        "community",
      ])
    )
    expect(first.extractedFields.resourceCategories).not.toContain("emergency")
    expect(second.extractedFields).toMatchObject({
      address: "201 S. Spring St.",
      city: "BARRINGTON",
      latitude: 42.15260812778155,
      longitude: -88.13330407405007,
      phone: "(847) 304-3400",
      normalizedPhone: "+18473043400",
      primaryResourceCategory: "emergency_cooling_centers",
    })
    expect(second.extractedFields.resourceCategories).toEqual(
      expect.arrayContaining(["emergency_cooling_centers", "environment"])
    )
    expect(second.extractedFields.resourceCategories).not.toContain("emergency")
  })

  it("uses source-specific field aliases for opaque civic export columns", async () => {
    const { parseRawPayload } = await import(pathToFileURL(PARSERS).href)
    const { normalizeCandidateRecord } = await import(
      pathToFileURL(NORMALIZER).href
    )
    const parsed = parseRawPayload(
      {
        raw_url:
          "https://services.example.org/Cooling_Centers_2026/FeatureServer/0/query",
        raw_text: JSON.stringify({
          features: [
            {
              attributes: {
                OBJECTID: 66,
                FIELD_NAME_B: "City of Delano",
                FIELD_NAME_E: "260 W 11th Ave, Delano, CA, 93215, USA",
                FIELD_NAME_I: "260 W. 11th Avenue",
                FIELD_NAME_J: "Delano",
                FIELD_NAME_K: "California",
                FIELD_NAME_L: 93215,
                FIELD_NAME_N: "Community Center",
                FIELD_NAME_R: "M-F 3PM - 7PM",
              },
              geometry: {
                x: -119.261608338,
                y: 35.768162727,
              },
            },
          ],
        }),
        content_type: "application/json",
        fetched_at: "2026-06-30T12:00:00.000Z",
      },
      {
        sourceId: "fixture-opaque-cooling-centers",
        name: "Fixture Opaque Cooling Centers",
        connectorType: "arcgis",
        sourceType: "api",
        sourceCategoryText: "Cooling Centers",
        metadata: {
          fieldAliases: {
            sourceRecordId: ["OBJECTID"],
            organizationName: ["FIELD_NAME_B"],
            title: ["FIELD_NAME_B"],
            address: ["FIELD_NAME_E", "FIELD_NAME_I"],
            city: ["FIELD_NAME_J"],
            state: ["FIELD_NAME_K"],
            postalCode: ["FIELD_NAME_L"],
            sourceCategoryText: ["FIELD_NAME_N"],
            hours: ["FIELD_NAME_R"],
          },
        },
      }
    )
    const normalized = normalizeCandidateRecord(parsed.records[0])

    expect(parsed.warnings).toEqual([])
    expect(parsed.records[0].sourceRecordId).toBe("66")
    expect(normalized.extractedFields).toMatchObject({
      organizationName: "City of Delano",
      title: "City of Delano",
      sourceCategoryText: "Cooling Centers; Community Center",
      address: "260 W 11th Ave, Delano, CA, 93215, USA",
      city: "Delano",
      state: "California",
      postalCode: "93215",
      latitude: 35.768162727,
      longitude: -119.261608338,
      primaryResourceCategory: "emergency_cooling_centers",
    })
    expect(normalized.extractedFields.resourceCategories).toEqual(
      expect.arrayContaining([
        "emergency_cooling_centers",
        "environment",
        "community_community_centers",
      ])
    )
    expect(normalized.extractedFields.resourceCategories).not.toContain(
      "emergency"
    )
    expect(normalized.extractedFields.hours).toMatchObject({
      label: "M-F 3PM - 7PM",
    })
  })

  it("parses schema.org JSON-LD service fields without inventing missing data", async () => {
    const { parseRawPayload } = await import(pathToFileURL(PARSERS).href)
    const { normalizeCandidateRecord } = await import(
      pathToFileURL(NORMALIZER).href
    )
    const parsed = parseRawPayload(
      {
        raw_url: "https://benefits.example.org/snap-help",
        raw_text: readFileSync(join(FIXTURES, "jsonld-service.html"), "utf8"),
        content_type: "text/html",
        fetched_at: "2026-06-29T12:00:00.000Z",
      },
      {
        sourceId: "fixture-jsonld",
        name: "Fixture JSON-LD service",
        connectorType: "static_html",
        sourceType: "scrape",
      }
    )
    const normalized = normalizeCandidateRecord(parsed.records[0])

    expect(parsed.warnings).toEqual([])
    expect(parsed.records).toHaveLength(1)
    expect(normalized.extractedFields).toMatchObject({
      organizationName: "Benefits Navigator",
      title: "Benefits Enrollment",
      description: "Help applying for food benefits.",
      sourceCategoryText: "Benefits Enrollment",
      address: "900 Benefit Ave",
      city: "Chicago",
      state: "IL",
      postalCode: "60610",
      phone: "312-555-0800",
      email: "help@benefits.example.org",
      websiteUrl: "https://benefits.example.org/snap-help",
      eligibility: "Illinois residents",
      cost: "Free",
      free: true,
    })
    expect(normalized.extractedFields.documentsNeeded).toEqual([
      "Photo ID",
      "Proof of income",
    ])
    expect(normalized.extractedFields.serviceArea).toEqual([
      "Cook County",
      "DuPage County",
    ])
    expect(normalized.extractedFields.deliveryModes).toEqual([
      "Online",
      "In person",
    ])
    expect(normalized.extractedFields.languages).toEqual(["English", "Spanish"])
    expect(normalized.extractedFields.resourceCategories).toEqual(
      expect.arrayContaining(["finance", "finance_benefits_enrollment"])
    )
  })

  it("falls back to visible HTML when JSON-LD is only page chrome", async () => {
    const { parseRawPayload } = await import(pathToFileURL(PARSERS).href)
    const parsed = parseRawPayload(
      {
        raw_url: "https://resources.example.org/legal-aid",
        raw_text: `
          <html>
            <head>
              <title>Legal aid intake</title>
              <script type="application/ld+json">
                {
                  "@context": "https://schema.org",
                  "@type": "BreadcrumbList",
                  "itemListElement": []
                }
              </script>
            </head>
            <body>
              <h1>West Side Legal Aid</h1>
              <p>Free housing law support.</p>
              <p>Category: Housing Law</p>
              <address>100 Justice Ave, Chicago, IL 60612</address>
              <a href="tel:+13125550100">Call</a>
            </body>
          </html>
        `,
        content_type: "text/html",
        fetched_at: "2026-06-29T12:00:00.000Z",
      },
      {
        sourceId: "fixture-html-fallback",
        name: "Fixture HTML fallback",
        connectorType: "static_html",
        sourceType: "scrape",
      }
    )

    expect(parsed.records).toHaveLength(1)
    expect(parsed.records[0].extractedFields).toMatchObject({
      title: "West Side Legal Aid",
      description: "Free housing law support.",
      sourceCategoryText: "Housing Law",
      address: "100 Justice Ave, Chicago, IL 60612",
      phone: "+13125550100",
    })
  })

  it("paginates CKAN Socrata and ArcGIS structured API sources", async () => {
    await withFixtureServer(
      (request, response) => {
        const url = new URL(request.url ?? "/", "http://127.0.0.1")
        response.setHeader("content-type", "application/json")

        if (url.pathname === "/socrata") {
          const rows = [
            {
              service_id: "socrata-page-1",
              agency: "City Food Access",
              service: "Meal pickup",
              service_category: "Community Meals",
              latitude: 41.88,
              longitude: -87.63,
            },
            {
              service_id: "socrata-page-2",
              agency: "City Food Access",
              service: "Food pantry",
              service_category: "Food Pantries",
              latitude: 41.89,
              longitude: -87.64,
            },
          ]
          const offset = Number(url.searchParams.get("$offset") ?? 0)
          const limit = Number(url.searchParams.get("$limit") ?? 1)
          response.end(JSON.stringify(rows.slice(offset, offset + limit)))
          return
        }

        if (url.pathname === "/arcgis/query") {
          const features = [
            {
              attributes: {
                objectid: "arcgis-page-1",
                name: "Digital Access Center",
                type: "Internet Access",
              },
              geometry: { x: -87.61, y: 41.87 },
            },
            {
              attributes: {
                objectid: "arcgis-page-2",
                name: "Community Library",
                type: "Libraries",
              },
              geometry: { x: -87.62, y: 41.86 },
            },
          ]
          const offset = Number(url.searchParams.get("resultOffset") ?? 0)
          const count = Number(url.searchParams.get("resultRecordCount") ?? 1)
          response.end(
            JSON.stringify({
              features: features.slice(offset, offset + count),
              exceededTransferLimit: offset + count < features.length,
            })
          )
          return
        }

        if (url.pathname === "/api/3/action/package_search") {
          const results = [
            {
              title: "Food resources page 1",
              notes: "Food access rows.",
              groups: [{ display_name: "Food" }],
              organization: { title: "Open Data" },
              resources: [
                {
                  id: "ckan-page-1",
                  name: "Food pantry CSV",
                  description: "Food pantry locations.",
                  url: "https://data.example.org/page-1.csv",
                },
              ],
            },
            {
              title: "Food resources page 2",
              notes: "Community meal rows.",
              groups: [{ display_name: "Food" }],
              organization: { title: "Open Data" },
              resources: [
                {
                  id: "ckan-page-2",
                  name: "Community meals CSV",
                  description: "Meal locations.",
                  url: "https://data.example.org/page-2.csv",
                },
              ],
            },
          ]
          const start = Number(url.searchParams.get("start") ?? 0)
          const rows = Number(url.searchParams.get("rows") ?? 1)
          response.end(
            JSON.stringify({
              success: true,
              result: {
                count: results.length,
                results: results.slice(start, start + rows),
              },
            })
          )
          return
        }

        response.statusCode = 404
        response.end(JSON.stringify({ error: "not found" }))
      },
      async (baseUrl) => {
        const { parseFetchedRaw, runConnectorFetch } = await import(
          pathToFileURL(CONNECTORS).href
        )
        const sources = [
          {
            sourceId: "paged-socrata",
            slug: "paged-socrata",
            name: "Paged Socrata",
            connectorType: "socrata",
            sourceType: "api",
            rawUrl: `${baseUrl}/socrata?$limit=1`,
            totalRows: 2,
            maxPages: 3,
          },
          {
            sourceId: "paged-arcgis",
            slug: "paged-arcgis",
            name: "Paged ArcGIS",
            connectorType: "arcgis",
            sourceType: "api",
            rawUrl: `${baseUrl}/arcgis`,
            pageSize: 1,
            maxPages: 3,
          },
          {
            sourceId: "paged-ckan",
            slug: "paged-ckan",
            name: "Paged CKAN",
            connectorType: "ckan",
            sourceType: "api",
            rawUrl: `${baseUrl}/ckan`,
            pageSize: 1,
            maxPages: 3,
          },
        ]
        const rawPayloads = []
        const records = []
        for (const source of sources) {
          const raw = await runConnectorFetch(source, "fixture-run", {
            retries: 0,
            timeoutMs: 5000,
          })
          rawPayloads.push(raw)
          records.push(...parseFetchedRaw(raw, source).records)
        }

        expect(records).toHaveLength(6)
        expect(records.map((record) => record.sourceRecordId)).toEqual(
          expect.arrayContaining([
            "socrata-page-1",
            "socrata-page-2",
            "arcgis-page-1",
            "arcgis-page-2",
            "ckan-page-1",
            "ckan-page-2",
          ])
        )
        expect(rawPayloads.map((raw) => raw.raw_payload.pagesFetched)).toEqual([
          2, 2, 2,
        ])
        expect(
          rawPayloads.flatMap((raw) =>
            (raw.raw_payload.fetchAttempts ?? []).map(
              (attempt: Record<string, unknown>) => attempt.page
            )
          )
        ).toEqual(expect.arrayContaining([1, 2]))
        expect(
          rawPayloads.flatMap((raw) =>
            (raw.raw_payload.fetchAttempts ?? []).map(
              (attempt: Record<string, unknown>) => attempt.page
            )
          )
        ).not.toContain(3)
      }
    )
  })

  it("ingests local connector fixtures into raw and normalized candidate stores", () => {
    withTempDir((directory) => {
      const registry = join(directory, "sources.jsonl")
      const output = join(directory, "candidates.jsonl")
      const engineDir = join(directory, "engine")
      const excelFixture = join(directory, "sample.xlsx")
      const playwrightFixture = join(directory, "playwright-resource.html")
      writeFileSync(excelFixture, buildXlsxFixture())
      writeFileSync(
        playwrightFixture,
        [
          "<!doctype html>",
          "<html><head><title>Community Ride Scheduler</title></head><body>",
          "<h1>Community Ride Scheduler</h1>",
          "<p>Category: Transportation</p>",
          "<p>Eligibility: Older adults and disabled residents.</p>",
          "<p>Hours: Tue, Thu 10:30am-2pm</p>",
          "<address>800 Transit Ave, Chicago, IL 60609</address>",
          '<a href="tel:+13125550600">312-555-0600</a>',
          '<a href="https://rides.example.org/request">Request a ride</a>',
          "</body></html>",
        ].join("")
      )
      const sources = [
        {
          sourceId: "fixture-csv",
          slug: "fixture-csv",
          name: "Fixture CSV",
          connectorType: "csv",
          sourceType: "csv",
          trustLevel: "official",
          rawUrl: join(FIXTURES, "sample.csv"),
        },
        {
          sourceId: "fixture-json",
          slug: "fixture-json",
          name: "Fixture JSON",
          connectorType: "json",
          sourceType: "api",
          trustLevel: "partner",
          rawUrl: join(FIXTURES, "sample.json"),
        },
        {
          sourceId: "fixture-xml",
          slug: "fixture-xml",
          name: "Fixture XML",
          connectorType: "xml",
          sourceType: "api",
          trustLevel: "official",
          rawUrl: join(FIXTURES, "sample.xml"),
        },
        {
          sourceId: "fixture-html",
          slug: "fixture-html",
          name: "Fixture HTML",
          connectorType: "static_html",
          sourceType: "scrape",
          trustLevel: "community",
          rawUrl: join(FIXTURES, "sample.html"),
        },
        {
          sourceId: "fixture-playwright",
          slug: "fixture-playwright",
          name: "Fixture Playwright",
          connectorType: "playwright_scrape",
          sourceType: "scrape",
          trustLevel: "community",
          rawUrl: playwrightFixture,
          retries: 0,
          playwrightWaitForSelector: "body",
        },
        {
          sourceId: "fixture-excel",
          slug: "fixture-excel",
          name: "Fixture Excel",
          connectorType: "excel",
          sourceType: "excel",
          trustLevel: "official",
          rawUrl: excelFixture,
        },
        {
          sourceId: "fixture-irs",
          slug: "fixture-irs",
          name: "Fixture IRS EO BMF",
          connectorType: "irs_eo_bmf",
          sourceType: "api",
          trustLevel: "official",
          rawUrl: join(FIXTURES, "irs-eo-bmf.txt"),
        },
        {
          sourceId: "fixture-socrata",
          slug: "fixture-socrata",
          name: "Fixture Socrata",
          connectorType: "socrata",
          sourceType: "api",
          trustLevel: "official",
          refreshCadence: "monthly",
          rawUrl: join(FIXTURES, "socrata.json"),
        },
        {
          sourceId: "fixture-arcgis",
          slug: "fixture-arcgis",
          name: "Fixture ArcGIS",
          connectorType: "arcgis",
          sourceType: "api",
          trustLevel: "official",
          rawUrl: join(FIXTURES, "arcgis.json"),
        },
        {
          sourceId: "fixture-sitemap",
          slug: "fixture-sitemap",
          name: "Fixture Sitemap",
          connectorType: "sitemap",
          sourceType: "scrape",
          trustLevel: "community",
          rawUrl: join(FIXTURES, "sitemap.xml"),
        },
        {
          sourceId: "fixture-ckan",
          slug: "fixture-ckan",
          name: "Fixture CKAN",
          connectorType: "ckan",
          sourceType: "api",
          trustLevel: "official",
          rawUrl: join(FIXTURES, "ckan.json"),
        },
        {
          sourceId: "fixture-osm",
          slug: "fixture-osm",
          name: "Fixture OSM",
          connectorType: "osm_overpass",
          sourceType: "api",
          trustLevel: "community",
          rawUrl: join(FIXTURES, "osm-overpass.json"),
        },
        {
          sourceId: "fixture-wikidata",
          slug: "fixture-wikidata",
          name: "Fixture Wikidata",
          connectorType: "wikidata_sparql",
          sourceType: "api",
          trustLevel: "community",
          rawUrl: join(FIXTURES, "wikidata-sparql.json"),
        },
      ]
      writeFileSync(
        registry,
        sources.map((source) => JSON.stringify(source)).join("\n")
      )

      const result = execFileSync(
        process.execPath,
        [
          INGEST,
          "--registry",
          registry,
          "--all",
          "--write",
          "--network",
          "false",
          "--output",
          output,
        ],
        {
          cwd: ROOT,
          encoding: "utf8",
          env: { ...process.env, RESOURCE_MAP_ENGINE_DIR: engineDir },
        }
      )

      expect(result).toContain("candidate records")
      const candidates = readJsonl(output)
      const rawPayloads = readJsonl(join(engineDir, "raw-payloads.jsonl"))
      const runs = readJsonl(join(engineDir, "runs.jsonl"))

      expect(rawPayloads[0]).toMatchObject({
        parser_version: "2026-06-28",
        connector_version: "2026-06-28",
        fetch_status: "fetched",
      })
      expect((rawPayloads[0] as any).raw_payload.fetchAttempts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            attempt: 1,
            status: "success",
          }),
        ])
      )
      expect(rawPayloads[0]?.checksum).toMatch(/^[a-f0-9]{64}$/)
      expect(runs[0]).toMatchObject({
        status: "completed",
        fetched_count: 13,
        parsed_count: 14,
        normalized_count: 14,
        classified_count: 14,
        deduped_count: 1,
      })

      expect(rawPayloads).toHaveLength(13)
      expect(candidates).toHaveLength(14)
      const playwrightRaw = rawPayloads.find(
        (raw) => raw.source_id === "fixture-playwright"
      ) as Record<string, any>
      expect(playwrightRaw.raw_payload).toEqual(
        expect.objectContaining({
          connectorType: "playwright_scrape",
          renderingMode: expect.stringMatching(
            /^(playwright|static_fallback)$/
          ),
          playwrightOptions: expect.objectContaining({
            waitForSelector: "body",
          }),
        })
      )
      expect(playwrightRaw.raw_payload.fetchAttempts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            status: "success",
          }),
        ])
      )
      const excelRaw = rawPayloads.find(
        (raw) => raw.source_id === "fixture-excel"
      ) as Record<string, any>
      expect(excelRaw.raw_payload).toMatchObject({
        connectorType: "excel",
        rawTextEncoding: "base64",
        rawByteLength: expect.any(Number),
      })
      const pantryRecords = candidates.filter((candidate) =>
        String((candidate as any).extractedFields?.title).includes(
          "food pantry"
        )
      ) as Array<Record<string, any>>
      expect(pantryRecords).toHaveLength(2)
      const pantry = pantryRecords[0]
      expect(pantry.extractedFields.resourceCategories).toEqual(
        expect.arrayContaining(["food", "food_food_pantries"])
      )
      expect(pantry.extractedFields.hours).toMatchObject({
        label: "Mon-Fri 9-5",
        weekly: [
          {
            days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
            opensAt: "09:00",
            closesAt: "17:00",
          },
        ],
      })
      expect(pantry.extractedFields.availabilityStatus).toBe("available")
      expect(pantry.extractedFields.appointmentRequired).toBe(false)
      expect(pantry.normalizedPhone).toBe("+13125550100")
      expect(pantry.trustScore).toBeGreaterThan(50)
      expect(pantry.fieldEvidence).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            fieldPath: "normalizedPhone",
            evidenceType: "derived",
            derivedFrom: ["extractedFields.phone"],
            transformation: "normalize_phone",
          }),
          expect.objectContaining({
            fieldPath: "extractedFields.taxonomyClassification",
            evidenceType: "derived",
            transformation: "deterministic_taxonomy_classifier",
          }),
          expect.objectContaining({
            fieldPath: "extractedFields.resourceCategories",
            evidenceType: "derived",
            transformation: "deterministic_taxonomy_classifier",
          }),
          expect.objectContaining({
            fieldPath: "extractedFields.geocodingAccuracy",
            evidenceType: "derived",
            transformation: "network_geocode_disabled",
          }),
          expect.objectContaining({
            fieldPath: "extractedFields.dataQuality",
            evidenceType: "derived",
            transformation: "attach_quality_metadata",
          }),
          expect.objectContaining({
            fieldPath: "trustScore",
            evidenceType: "derived",
            transformation: "score_record_trust",
          }),
          expect.objectContaining({
            fieldPath: "freshnessScore",
            evidenceType: "derived",
            transformation: "score_record_freshness",
          }),
          expect.objectContaining({
            fieldPath: "extractedFields.hours.weekly",
            evidenceType: "derived",
            transformation: "normalize_hours_label",
          }),
          expect.objectContaining({
            fieldPath: "extractedFields.availabilityStatus",
            evidenceType: "derived",
            transformation: "normalize_availability",
          }),
          expect.objectContaining({
            fieldPath: "extractedFields.free",
            evidenceType: "derived",
            transformation: "normalize_cost",
          }),
          expect.objectContaining({
            fieldPath: "extractedFields.domain",
            evidenceType: "derived",
            transformation: "normalize_domain",
          }),
        ])
      )
      expect(pantry.extractedFields.dataQuality.flags).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: "geocode_unattempted" }),
        ])
      )
      const duplicatePantry = pantryRecords.find(
        (candidate) => candidate.duplicateMatchStatus === "duplicate"
      )
      expect(duplicatePantry?.extractedFields.dedupe).toMatchObject({
        status: "duplicate",
        duplicateConfidence: 100,
      })

      const clinic = candidates.find((candidate) =>
        String(candidate.sourceUrl).includes("clinic.example")
      ) as Record<string, any>
      expect(clinic.normalizedDomain).toBe("clinic.example.org")
      expect(clinic.extractedFields.resourceCategories).toEqual(
        expect.arrayContaining(["health", "health_primary_care"])
      )
      expect(clinic.extractedFields.normalization.costType).toBe(
        "sliding_scale"
      )

      const legalAid = candidates.find((candidate) =>
        String((candidate as any).extractedFields?.title).includes(
          "Legal Aid Immigration Clinic"
        )
      ) as Record<string, any>
      expect(legalAid.extractedFields).toMatchObject({
        address: "400 Justice Ave, Chicago, IL 60603",
        phone: "+13125550400",
        email: "intake@legalaid.example.org",
        eligibility: "Open to local residents.",
        cost: "Free",
        free: true,
      })
      expect(legalAid.extractedFields.pageHeadings).toEqual([
        "Legal Aid Immigration Clinic",
        "Immigration legal aid appointments",
      ])
      expect(legalAid.extractedFields.languages).toEqual(["English", "Spanish"])
      expect(legalAid.extractedFields.documentsNeeded).toEqual([
        "Photo ID",
        "proof of address",
      ])
      expect(legalAid.extractedFields.serviceArea).toEqual(["Cook County"])
      expect(legalAid.extractedFields.deliveryModes).toEqual([
        "In person",
        "Online intake",
      ])
      expect(legalAid.extractedFields.normalization.costType).toBe("free")
      expect(legalAid.extractedFields.hours).toMatchObject({
        label: "Monday-Friday 9am-5pm",
        weekly: [
          {
            days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
            opensAt: "09:00",
            closesAt: "17:00",
          },
        ],
      })
      expect(legalAid.extractedFields.links).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            url: "https://legalaid.example.org/intake",
            label: "Apply for legal help",
          }),
        ])
      )
      expect(legalAid.extractedFields.resourceCategories).toEqual(
        expect.arrayContaining(["legal", "legal_immigration"])
      )

      const rideScheduler = candidates.find((candidate) =>
        String((candidate as any).extractedFields?.title).includes(
          "Community Ride Scheduler"
        )
      ) as Record<string, any>
      expect(rideScheduler.extractedFields).toMatchObject({
        address: "800 Transit Ave, Chicago, IL 60609",
        phone: "+13125550600",
        eligibility: "Older adults and disabled residents.",
      })
      expect(rideScheduler.extractedFields.hours).toMatchObject({
        label: "Tue, Thu 10:30am-2pm",
        weekly: [
          {
            days: ["tuesday", "thursday"],
            opensAt: "10:30",
            closesAt: "14:00",
          },
        ],
      })
      expect(rideScheduler.extractedFields.resourceCategories).toEqual(
        expect.arrayContaining(["community", "community_transportation"])
      )

      const workforce = candidates.find((candidate) =>
        String((candidate as any).extractedFields?.title).includes(
          "Resume help"
        )
      ) as Record<string, any>
      expect(workforce.extractedFields).toMatchObject({
        organizationName: "Neighborhood Workforce Center",
        title: "Resume help and job search",
        address: "500 Work Ave, Chicago, IL 60607",
        phone: "312-555-0500",
        websiteUrl: "https://workforce.example.org",
      })
      expect(workforce.extractedFields.resourceCategories).toEqual(
        expect.arrayContaining(["employment", "employment_job_search"])
      )

      const irsNonprofit = candidates.find(
        (candidate) => candidate.sourceRecordId === "360000001"
      ) as Record<string, any>
      expect(irsNonprofit.extractedFields).toMatchObject({
        organizationName: "Community Health Nonprofit",
        title: "Community Health Nonprofit",
        address: "700 Wellness Ave",
        city: "Chicago",
        state: "IL",
        postalCode: "60608",
        sourceCategoryText: "Health nonprofit; E32",
      })
      expect(irsNonprofit.extractedFields.resourceCategories).toEqual(
        expect.arrayContaining(["health"])
      )

      const library = candidates.find(
        (candidate) =>
          (candidate as any).extractedFields?.title === "Internet access"
      ) as Record<string, any>
      expect(library.extractedFields).toMatchObject({
        latitude: 41.8781,
        longitude: -87.6298,
        geocodingProvider: "source",
        geocodingConfidence: 100,
      })
      expect(library.fieldEvidence).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            fieldPath: "extractedFields.latitude",
            evidenceType: "source",
            transformation: "source_coordinate_preserved",
          }),
          expect.objectContaining({
            fieldPath: "extractedFields.geocodingProvider",
            evidenceType: "source",
            transformation: "source_coordinate_preserved",
          }),
        ])
      )

      const seniorMeals = candidates.find((candidate) =>
        String((candidate as any).extractedFields?.title).includes(
          "Senior meal"
        )
      ) as Record<string, any>
      expect(seniorMeals.reasonCodes).toEqual(
        expect.arrayContaining(["official_source_unverified", "stale_source"])
      )
      expect(seniorMeals.extractedFields.dataQuality.flags).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: "stale_source" }),
        ])
      )

      const sitemap = candidates.find((candidate) =>
        String(candidate.sourceUrl).includes("mutualaid.example")
      ) as Record<string, any>
      expect(sitemap.extractedFields.sourceUrl).toBe(
        "https://mutualaid.example.org/resources"
      )

      const ckan = candidates.find((candidate) =>
        String(candidate.sourceUrl).includes("food-pantries.csv")
      ) as Record<string, any>
      expect(ckan.sourceRecordId).toBe("ckan-food-1")
      expect(ckan.extractedFields.resourceCategories).toEqual(
        expect.arrayContaining(["food"])
      )

      const osm = candidates.find(
        (candidate) => candidate.sourceRecordId === "osm:node:123"
      ) as Record<string, any>
      expect(osm.extractedFields).toMatchObject({
        organizationName: "Open Pantry OSM",
        title: "Open Pantry OSM",
        sourceCategoryText: "food_bank; social_facility",
        address: "500 Map St",
        city: "Chicago",
        state: "IL",
        postalCode: "60601",
        phone: "312-555-0600",
        email: "hello@osm-pantry.example.org",
        websiteUrl: "https://osm-pantry.example.org",
        latitude: 41.88,
        longitude: -87.63,
        geocodingProvider: "source",
      })
      expect(osm.extractedFields.hours).toMatchObject({
        label: "Mon-Fri 9-5",
        weekly: [
          {
            days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
            opensAt: "09:00",
            closesAt: "17:00",
          },
        ],
      })
      expect(osm.extractedFields.resourceCategories).toEqual(
        expect.arrayContaining(["food", "food_food_pantries"])
      )

      const wikidata = candidates.find(
        (candidate) => candidate.sourceRecordId === "Q123"
      ) as Record<string, any>
      expect(wikidata.sourceUrl).toBe("http://www.wikidata.org/entity/Q123")
      expect(wikidata.extractedFields).toMatchObject({
        organizationName: "Example Community Library",
        title: "Example Community Library",
        sourceCategoryText: "library",
        address: "1 Knowledge Way",
        city: "Chicago",
        state: "Illinois",
        postalCode: "60602",
        phone: "312-555-0700",
        email: "info@library.example.org",
        websiteUrl: "https://library.example.org",
        sourceUrl: "http://www.wikidata.org/entity/Q123",
      })
      expect(wikidata.extractedFields.resourceCategories).toEqual(
        expect.arrayContaining(["community", "community_libraries"])
      )

      execFileSync(
        process.execPath,
        [
          INGEST,
          "--registry",
          registry,
          "--all",
          "--write",
          "--network",
          "false",
          "--output",
          output,
        ],
        {
          cwd: ROOT,
          encoding: "utf8",
          env: { ...process.env, RESOURCE_MAP_ENGINE_DIR: engineDir },
        }
      )
      const secondRawPayloads = readJsonl(join(engineDir, "raw-payloads.jsonl"))
      const secondRun = readJsonl(join(engineDir, "runs.jsonl")).at(-1) as any
      const secondCandidates = readJsonl(output)
      expect(secondRawPayloads).toHaveLength(13)
      expect(secondRun.fetched_count).toBe(0)
      expect(secondRun.parsed_count).toBe(14)
      expect(secondCandidates).toHaveLength(14)
    })
  }, 120_000)

  it("updates source freshness on unchanged checksum reruns without duplicating raw payloads", () => {
    withTempDir((directory) => {
      const registry = join(directory, "sources.jsonl")
      const output = join(directory, "candidates.jsonl")
      const engineDir = join(directory, "engine")
      writeFileSync(
        registry,
        JSON.stringify({
          sourceId: "unchanged-json",
          slug: "unchanged-json",
          name: "Unchanged JSON",
          connectorType: "json",
          sourceType: "api",
          trustLevel: "partner",
          rawUrl: join(FIXTURES, "sample.json"),
        })
      )

      execFileSync(
        process.execPath,
        [
          INGEST,
          "--registry",
          registry,
          "--source",
          "unchanged-json",
          "--write",
          "--output",
          output,
        ],
        {
          cwd: ROOT,
          encoding: "utf8",
          env: { ...process.env, RESOURCE_MAP_ENGINE_DIR: engineDir },
        }
      )

      const rawStore = join(engineDir, "raw-payloads.jsonl")
      const [firstRaw] = readJsonl(rawStore) as Array<Record<string, any>>
      const staleFetchedAt = "2020-01-01T00:00:00.000Z"
      writeFileSync(
        rawStore,
        `${JSON.stringify({ ...firstRaw, fetched_at: staleFetchedAt })}\n`
      )

      execFileSync(
        process.execPath,
        [
          INGEST,
          "--registry",
          registry,
          "--source",
          "unchanged-json",
          "--write",
          "--output",
          output,
        ],
        {
          cwd: ROOT,
          encoding: "utf8",
          env: { ...process.env, RESOURCE_MAP_ENGINE_DIR: engineDir },
        }
      )

      const rawPayloads = readJsonl(rawStore) as Array<Record<string, any>>
      const runs = readJsonl(join(engineDir, "runs.jsonl")) as Array<
        Record<string, any>
      >
      expect(rawPayloads).toHaveLength(1)
      expect(rawPayloads[0]).toMatchObject({
        checksum: firstRaw.checksum,
        fetch_status: "fetched",
      })
      expect(new Date(rawPayloads[0].fetched_at).getTime()).toBeGreaterThan(
        new Date(staleFetchedAt).getTime()
      )
      expect(rawPayloads[0].raw_payload).toMatchObject({
        firstFetchedAt: staleFetchedAt,
        duplicateFetchCount: 1,
        latestFetchedAt: rawPayloads[0].fetched_at,
      })
      expect(rawPayloads[0].raw_payload.duplicateFetchReceipts).toEqual([
        expect.objectContaining({
          fetchStatus: "duplicate",
          rawUrl: firstRaw.raw_url,
        }),
      ])
      expect(runs.at(-1)).toMatchObject({
        fetched_count: 0,
        parsed_count: expect.any(Number),
      })
    })
  }, 30_000)

  it("preserves connector retry attempts for failed raw fetches", () => {
    withTempDir((directory) => {
      const registry = join(directory, "sources.jsonl")
      const engineDir = join(directory, "engine")
      writeFileSync(
        registry,
        JSON.stringify({
          sourceId: "missing-json",
          slug: "missing-json",
          name: "Missing JSON",
          connectorType: "json",
          rawUrl: join(directory, "missing.json"),
        })
      )

      const output = execFileSync(
        process.execPath,
        [
          INGEST,
          "--registry",
          registry,
          "--source",
          "missing-json",
          "--write",
          "--retries",
          "2",
          "--retry-delay-ms",
          "0",
        ],
        {
          cwd: ROOT,
          encoding: "utf8",
          env: { ...process.env, RESOURCE_MAP_ENGINE_DIR: engineDir },
        }
      )

      expect(output).toContain("Wrote 0 candidate records")
      const rawPayloads = readJsonl(join(engineDir, "raw-payloads.jsonl"))
      const runs = readJsonl(join(engineDir, "runs.jsonl"))
      expect(rawPayloads).toHaveLength(1)
      expect(rawPayloads[0]).toMatchObject({
        source_id: "missing-json",
        fetch_status: "failed",
      })
      expect(
        (rawPayloads[0] as any).raw_payload.connectorOptions
      ).toMatchObject({
        retries: 2,
        retryDelayMs: 0,
      })
      expect((rawPayloads[0] as any).raw_payload.fetchAttempts).toHaveLength(3)
      expect((rawPayloads[0] as any).raw_payload.fetchAttempts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ attempt: 1, status: "failed" }),
          expect.objectContaining({ attempt: 2, status: "failed" }),
          expect.objectContaining({ attempt: 3, status: "failed" }),
        ])
      )
      expect(runs[0]).toMatchObject({
        status: "completed_with_errors",
        fetched_count: 0,
      })
    })
  })

  it("defines private raw store and run tracking tables for Supabase staging", () => {
    const migration = readFileSync(MIGRATION, "utf8")
    const schemaIndex = readFileSync(SCHEMA_INDEX, "utf8")

    expect(migration).toContain(
      "create table if not exists public.resource_map_ingestion_runs"
    )
    expect(migration).toContain(
      "create table if not exists public.resource_map_raw_ingestion_records"
    )
    expect(migration).toContain("checksum text not null")
    expect(migration).toContain("raw_payload jsonb not null")
    expect(migration).toContain("raw_text text")
    expect(migration).toContain(
      "fetch_status in ('pending', 'fetched', 'duplicate'"
    )
    expect(migration).toContain("enable row level security")
    expect(migration).toContain(
      "resource_map_raw_ingestion_records_admin_manage"
    )
    expect(migration).toContain("raw_ingestion_record_id uuid")
    expect(schemaIndex).toContain("ResourceMapIngestionRunsTable")
    expect(schemaIndex).toContain("ResourceMapRawIngestionRecordsTable")
  })

  it("documents commands connector contract and audit model", () => {
    const runbook = readFileSync(RUNBOOK, "utf8")
    const readme = readFileSync(LOCAL_README, "utf8")
    const packageJson = readFileSync(PACKAGE_JSON, "utf8")

    expect(runbook).toContain("Source Discovery")
    expect(runbook).toContain("-> Raw Store")
    expect(runbook).toContain("data/resource-map/.engine")
    expect(runbook).toContain("pnpm data:discover")
    expect(runbook).toContain("--registry-dry-run")
    expect(runbook).toContain("pnpm data:ingest -- --source")
    expect(runbook).toContain("--retries")
    expect(runbook).toContain("fetchAttempts")
    expect(runbook).toContain("pnpm data:check-links")
    expect(runbook).toContain("pnpm data:source-freshness")
    expect(runbook).toContain("pnpm data:retry-failed")
    expect(runbook).toContain("pnpm data:refresh-stale")
    expect(runbook).toContain("pnpm data:run-jobs")
    expect(runbook).toContain("pnpm data:reprocess")
    expect(runbook).toContain("candidate_reprocess")
    expect(runbook).toContain("csv, json, xml, excel, ckan, socrata, arcgis")
    expect(runbook).toContain("Duplicate source records are preserved")
    expect(runbook).toContain("coach-house-taxonomy-v1")
    expect(runbook).toContain("fieldEvidence")
    expect(runbook).toContain("trustScore, freshnessScore, confidenceScore")
    expect(readme).toContain("docs/resource-map-data-engine-runbook.md")
    expect(readme).toContain("pnpm data:discover")
    expect(readme).toContain("pnpm data:ingest -- --type socrata")
    expect(readme).toContain("pnpm data:reprocess")
    expect(packageJson).toContain('"data:check-links"')
    expect(packageJson).toContain('"data:source-freshness"')
    expect(packageJson).toContain('"data:retry-failed"')
    expect(packageJson).toContain('"data:refresh-stale"')
    expect(packageJson).toContain('"data:run-jobs"')
    expect(packageJson).toContain('"data:reprocess"')
  })
})


describe("promoted resource topics", () => {
  it("preserves actionable services without obsolete Community matches", async () => {
    const { classifyResourceTaxonomy } = await import(
      pathToFileURL(TAXONOMY_CLASSIFIER).href
    )
    const { buildCanonicalPayload } = await import(
      pathToFileURL(join(ROOT, "scripts/resource-map/lib/promotion-payloads.mjs")).href
    )
    const { publicMapResourceCategoryMatchesTopLevel } = await import(
      "@/lib/public-map/resource-categories"
    )
    const fields = {
      sourceCategoryText: "Faith Organizations",
      title: "Church Food Pantry",
    }
    const mixed = classifyResourceTaxonomy({ extractedFields: fields })
    expect(mixed.resourceCategories).toContain("food_food_pantries")
    expect(mixed.resourceCategories).toContain("faith")
    expect(mixed.resourceCategories).not.toContain("community")
    const payload = buildCanonicalPayload({
      extracted_fields: {
        ...fields,
        resourceCategories: mixed.resourceCategories,
        taxonomyClassification: mixed,
      },
    }, false)
    expect(payload.categoryKeys).toEqual(mixed.resourceCategories)
    expect(publicMapResourceCategoryMatchesTopLevel({
      category: "food_food_pantries",
      topLevelCategory: "food",
    })).toBe(true)
    for (const topic of ["faith", "recreation", "sports", "arts", "culture"]) {
      const result = classifyResourceTaxonomy({
        extractedFields: { sourceCategoryText: topic },
      })
      expect(result.resourceCategories).not.toContain("community")
    }
    expect(classifyResourceTaxonomy({
      extractedFields: { sourceCategoryText: "Community Organizing" },
    }).resourceCategories).toContain("community")
  })

  it("preserves canonical topics, promoted leaves and confidence through promotion", async () => {
    const { buildCanonicalPayload } = await import(
      pathToFileURL(join(ROOT, "scripts/resource-map/lib/promotion-payloads.mjs")).href
    )
    const { resolveResourceCategoryKey, RESOURCE_CATEGORY_GROUPS } = await import(
      pathToFileURL(join(ROOT, "scripts/resource-map/lib/promotion-normalizers.mjs")).href
    )
    const {
      PUBLIC_MAP_RESOURCE_CATEGORY_ORDER,
      PUBLIC_MAP_RESOURCE_SUBCATEGORY_GROUPS,
    } = await import("@/lib/public-map/resource-categories")
    for (const key of PUBLIC_MAP_RESOURCE_CATEGORY_ORDER) {
      expect(resolveResourceCategoryKey(key)).toBe(key)
      const payload = buildCanonicalPayload({
        extracted_fields: {
          organizationName: "Category contract fixture",
          title: "Category contract fixture",
          resourceCategories: [key],
          taxonomyClassification: { categories: [{ key, confidence: 91 }] },
        },
      }, false)
      expect(payload.categoryKeys).toEqual([key])
      expect(payload.categoryConfidenceByKey[key]).toBe(91)
    }
    for (const key of ["arts", "faith", "recreation", "philanthropy"] as const) {
      expect(RESOURCE_CATEGORY_GROUPS[key]).toEqual(
        PUBLIC_MAP_RESOURCE_SUBCATEGORY_GROUPS[key]
      )
      for (const [leaf] of RESOURCE_CATEGORY_GROUPS[key]) {
        expect(resolveResourceCategoryKey(leaf)).toBe(leaf)
      }
    }
    for (const [label, key] of [
      ["Arts & Culture", "arts"],
      ["Faith & Religion", "faith"],
      ["Sports & Recreation", "recreation"],
      ["Philanthropy & Grantmaking", "philanthropy"],
    ]) {
      expect(resolveResourceCategoryKey(label)).toBe(key)
    }
  })
})
