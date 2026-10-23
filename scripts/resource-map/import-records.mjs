#!/usr/bin/env node
import { pathToFileURL } from "node:url"

import { createResourceMapAdminClient } from "./lib/env.mjs"
import { analyzeResourceEnrichmentReadiness } from "./lib/enrichment-quality.mjs"
import {
  buildNormalizedImportFields,
  resolveExtractedFields,
} from "./lib/normalization.mjs"
import {
  buildRawIngestionPlan,
  readRawRunId,
  resolveImportRunId,
} from "./lib/import-raw-provenance.mjs"
import { buildQualityImportFields } from "./lib/import-quality-fields.mjs"
import { readResourceMapRecords } from "./lib/read-records.mjs"

const LOOKUP_CHUNK_SIZE = 100
const RECORD_WRITE_CHUNK_SIZE = 10
const EVIDENCE_WRITE_CHUNK_SIZE = 200
const TRANSIENT_FETCH_ATTEMPTS = 3
const MAX_EXISTING_ONLY_REFRESH = 25

function parseArgs(argv) {
  const args = new Map()
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (!arg.startsWith("--")) continue
    const key = arg.slice(2)
    const next = argv[i + 1]
    if (!next || next.startsWith("--")) {
      args.set(key, true)
    } else {
      args.set(key, next)
      i += 1
    }
  }
  return args
}

export function chunkValues(values, size) {
  const chunks = []
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size))
  }
  return chunks
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function retryTransientFetch(operation) {
  for (let attempt = 1; attempt <= TRANSIENT_FETCH_ATTEMPTS; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      const isTransientFetchFailure =
        error instanceof TypeError && /fetch failed/iu.test(error.message)
      if (!isTransientFetchFailure || attempt === TRANSIENT_FETCH_ATTEMPTS) {
        throw error
      }
      await wait(attempt * 250)
    }
  }
  throw new Error("Transient fetch retry loop ended unexpectedly.")
}

async function insertRowsInChunks({ admin, rows, select, size, table }) {
  const insertedRows = []
  for (const chunk of chunkValues(rows, size)) {
    const { data, error } = await retryTransientFetch(async () => {
      let query = admin.from(table).insert(chunk)
      if (select) query = query.select(select)
      return query
    })
    if (error) throw error
    if (data) insertedRows.push(...data)
  }
  return insertedRows
}

async function upsertSource(admin, args) {
  const slug = String(args.get("source-slug") ?? "").trim()
  const name = String(args.get("source-name") ?? slug).trim()
  if (!slug || !name) {
    throw new Error("--source-slug and --source-name are required.")
  }

  const optionalFields = [
    ["source-homepage", "homepage_url"],
    ["source-type", "source_type"],
    ["license-label", "license_label"],
    ["license-url", "license_url"],
    ["attribution", "attribution"],
    ["trust-level", "trust_level"],
  ]
  const payload = { name, slug }
  for (const [argument, field] of optionalFields) {
    if (args.has(argument)) payload[field] = args.get(argument) || null
  }

  const { data: existing, error: existingError } = await retryTransientFetch(
    () =>
      admin
        .from("resource_map_sources")
        .select("id")
        .eq("slug", slug)
        .maybeSingle()
  )
  if (existingError) throw existingError

  const { data, error } = existing
    ? await retryTransientFetch(() =>
        admin
          .from("resource_map_sources")
          .update(payload)
          .eq("id", existing.id)
          .select("id")
          .maybeSingle()
      )
    : await retryTransientFetch(() =>
        admin
          .from("resource_map_sources")
          .insert({
            metadata: {
              importedBy: "scripts/resource-map/import-records.mjs",
            },
            source_type: "manual",
            trust_level: "unverified",
            ...payload,
          })
          .select("id")
          .maybeSingle()
      )

  if (error) throw error
  if (!data) throw new Error("Unable to upsert resource map source.")
  return data.id
}

function normalizeImportSourceType(value) {
  const sourceType = String(value ?? "manual")
    .trim()
    .toLowerCase()
  if (["website", "api", "csv", "directory", "manual"].includes(sourceType)) {
    return sourceType
  }
  if (["scrape", "static_html", "playwright_scrape"].includes(sourceType)) {
    return "website"
  }
  if (
    ["partner", "seed", "excel", "json", "xml", "sitemap"].includes(sourceType)
  ) {
    return "manual"
  }
  return "manual"
}

function normalizeDuplicateMatchStatus(value) {
  const status = String(value ?? "unknown")
    .trim()
    .toLowerCase()
  return ["unknown", "candidate", "matched", "duplicate", "unique"].includes(
    status
  )
    ? status
    : "unknown"
}

export function buildImportRecord(
  record,
  sourceId,
  batchId,
  rawIngestionRecordId
) {
  const extractedFields = resolveExtractedFields(record)
  const enrichment = readObject(extractedFields.enrichment)
  const verification = readObject(enrichment.verification)
  const normalized = buildNormalizedImportFields(record)
  const quality = buildQualityImportFields(record, extractedFields)
  const dedupe = extractedFields.dedupe ?? extractedFields.duplicate ?? {}

  return {
    source_id: sourceId,
    batch_id: batchId,
    raw_ingestion_record_id: rawIngestionRecordId ?? null,
    source_record_id:
      record.sourceRecordId ?? record.source_record_id ?? record.id ?? null,
    source_url: record.sourceUrl ?? record.source_url ?? null,
    source_type: normalizeImportSourceType(
      record.sourceType ?? record.source_type ?? extractedFields.sourceType
    ),
    raw_snapshot: record.rawSnapshot ?? record.raw_snapshot ?? record,
    extracted_fields: extractedFields,
    field_confidence:
      record.fieldConfidence ??
      record.field_confidence ??
      record.confidence ??
      {},
    confidence_score: record.confidenceScore ?? record.confidence_score ?? null,
    ...quality,
    ...normalized,
    review_status: "needs_review",
    duplicate_match_status: normalizeDuplicateMatchStatus(
      record.duplicateMatchStatus ??
        record.duplicate_match_status ??
        dedupe.status
    ),
    promotion_status: "not_promoted",
    license_notes: record.licenseNotes ?? record.license_notes ?? null,
    attribution: record.attribution ?? null,
    terms_notes: record.termsNotes ?? record.terms_notes ?? null,
    last_seen_at: record.lastSeenAt ?? record.last_seen_at ?? null,
    last_scraped_at:
      record.lastScrapedAt ??
      record.last_scraped_at ??
      new Date().toISOString(),
    last_verified_at:
      record.lastVerifiedAt ??
      record.last_verified_at ??
      (verification.status === "approved"
        ? (record.lastEnrichedAt ?? record.last_enriched_at ?? null)
        : null),
  }
}

function summarizeRawPlan(rows, input, args) {
  const rawPlan = buildRawIngestionPlan(rows, {
    sourceId: "00000000-0000-4000-8000-000000000000",
    input,
    now: "2026-06-28T00:00:00.000Z",
  })
  const runId = resolveImportRunId(rows, args.get("run-id"))
  return {
    runId,
    rawCount: rawPlan.rawRows.length,
  }
}

function readConfidence(fieldConfidence, fieldPath) {
  if (!fieldConfidence || typeof fieldConfidence !== "object") return null
  const value = fieldConfidence[fieldPath]
  if (typeof value !== "number") return null
  return value
}

function readStringValue(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return null
}

function readStringArray(value) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
      .filter(Boolean)
  }
  if (typeof value === "string" && value.trim()) return [value.trim()]
  return []
}

function readObject(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {}
}

function localSourceSlug(record) {
  return record.sourceId ?? record.source_id ?? null
}

function selectExistingOnlyRows(rows, sourceSlug) {
  return rows.filter(
    (record) =>
      localSourceSlug(record) === sourceSlug &&
      analyzeResourceEnrichmentReadiness(record).publishable
  )
}

function readEvidenceArray(record) {
  const value = record.fieldEvidence ?? record.field_evidence ?? record.evidence
  return Array.isArray(value) ? value : []
}

export function resolveEvidenceFieldValue(record, fieldPath) {
  const segments = String(fieldPath ?? "")
    .replace(/^(?:extractedFields|extracted_fields)\./u, "")
    .split(".")
    .filter(Boolean)
  let value = resolveExtractedFields(record)
  for (const segment of segments) {
    if (!value || typeof value !== "object" || !(segment in value)) return null
    value = value[segment]
  }
  return value ?? null
}

function normalizeEvidenceEntry({
  evidence,
  fieldPath,
  fieldValue,
  importRecord,
  sourceId,
  observedAt,
  confidenceScore,
}) {
  const resolvedFieldPath =
    evidence?.fieldPath ?? evidence?.field_path ?? evidence?.path ?? fieldPath
  const normalizedPath =
    typeof resolvedFieldPath === "string" ? resolvedFieldPath.trim() : ""
  if (!normalizedPath) return null
  const derivedFrom = readStringArray(
    evidence?.derivedFrom ?? evidence?.derived_from
  )
  const normalizedFieldValue =
    evidence?.fieldValue ??
    evidence?.field_value ??
    evidence?.value ??
    fieldValue
  if (normalizedFieldValue === null || normalizedFieldValue === undefined) {
    return null
  }

  return {
    import_record_id: importRecord.id,
    source_id: sourceId,
    field_path: normalizedPath,
    field_value: normalizedFieldValue,
    confidence_score:
      evidence?.confidenceScore ??
      evidence?.confidence_score ??
      confidenceScore ??
      null,
    source_url:
      evidence?.sourceUrl ??
      evidence?.source_url ??
      importRecord.source_url ??
      null,
    evidence_type:
      readStringValue(evidence?.evidenceType, evidence?.evidence_type) ??
      (derivedFrom.length > 0 ? "derived" : "source"),
    derived_from: derivedFrom,
    transformation: readStringValue(
      evidence?.transformation,
      evidence?.transform
    ),
    evidence_metadata: readObject(
      evidence?.evidenceMetadata ??
        evidence?.evidence_metadata ??
        evidence?.metadata
    ),
    observed_at:
      evidence?.observedAt ??
      evidence?.observed_at ??
      observedAt ??
      new Date().toISOString(),
  }
}

export function buildFieldEvidenceRecords(record, importRecord, sourceId) {
  const explicitEvidence = readEvidenceArray(record)
  const fieldConfidence =
    record.fieldConfidence ?? record.field_confidence ?? record.confidence ?? {}
  const observedAt =
    record.lastScrapedAt ??
    record.last_scraped_at ??
    record.lastSeenAt ??
    record.last_seen_at ??
    null

  if (explicitEvidence.length > 0) {
    return explicitEvidence
      .map((evidence) => {
        const fieldPath =
          evidence?.fieldPath ?? evidence?.field_path ?? evidence?.path
        return normalizeEvidenceEntry({
          evidence,
          importRecord,
          sourceId,
          observedAt,
          fieldValue: resolveEvidenceFieldValue(record, fieldPath),
          confidenceScore: null,
        })
      })
      .filter(Boolean)
  }

  return Object.entries(resolveExtractedFields(record))
    .map(([fieldPath, fieldValue]) => {
      if (
        fieldValue === null ||
        fieldValue === undefined ||
        fieldValue === ""
      ) {
        return null
      }

      return normalizeEvidenceEntry({
        evidence: null,
        fieldPath,
        fieldValue,
        importRecord,
        sourceId,
        observedAt,
        confidenceScore: readConfidence(fieldConfidence, fieldPath),
      })
    })
    .filter(Boolean)
}

async function upsertIngestionRun(admin, { args, input, rows, sourceId }) {
  const runId = resolveImportRunId(rows, args.get("run-id"))
  const sourceRunIds = [
    ...new Set(rows.map(readRawRunId).filter((value) => value)),
  ]
  const connectorTypes = [
    ...new Set(
      rows
        .map((row) => {
          const raw =
            row.rawIngestion ??
            row.raw_ingestion ??
            row.rawSnapshot ??
            row.raw_snapshot
          return raw?.connectorType ?? raw?.connector_type ?? null
        })
        .filter(Boolean)
    ),
  ]

  const { data, error } = await admin
    .from("resource_map_ingestion_runs")
    .upsert(
      {
        run_id: runId,
        source_id: sourceId,
        run_kind: args.get("run-kind") || "staging_import",
        connector_type: args.get("connector-type") || connectorTypes[0] || null,
        status: "running",
        started_at: new Date().toISOString(),
        finished_at: null,
        fetched_count: 0,
        parsed_count: rows.length,
        normalized_count: 0,
        classified_count: 0,
        deduped_count: 0,
        flagged_count: 0,
        errors: [],
        metadata: {
          importedBy: "scripts/resource-map/import-records.mjs",
          input,
          sourceRunIds,
        },
      },
      { onConflict: "run_id" }
    )
    .select("id,run_id")
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error("Unable to upsert ingestion run.")
  return data
}

async function finishIngestionRun(admin, runId, patch) {
  if (!runId) return
  await admin
    .from("resource_map_ingestion_runs")
    .update({
      ...patch,
      finished_at: new Date().toISOString(),
    })
    .eq("id", runId)
}

async function markBatchFailed(admin, batchId, message, errorCount) {
  await admin
    .from("resource_map_import_batches")
    .update({
      status: "failed",
      error_count: errorCount,
      error_log: [{ message }],
      completed_at: new Date().toISOString(),
    })
    .eq("id", batchId)
}

async function upsertRawIngestionRecords(admin, rawRows) {
  if (rawRows.length === 0) return new Map()

  const sourceId = rawRows[0].source_id
  const checksums = [...new Set(rawRows.map((row) => row.checksum))]
  const existingRows = []
  for (const checksumChunk of chunkValues(checksums, LOOKUP_CHUNK_SIZE)) {
    const { data, error } = await retryTransientFetch(() =>
      admin
        .from("resource_map_raw_ingestion_records")
        .select("id,source_id,checksum")
        .eq("source_id", sourceId)
        .in("checksum", checksumChunk)
    )
    if (error) throw error
    existingRows.push(...(data ?? []))
  }

  const byKey = new Map(
    existingRows.map((row) => [`${row.source_id}:${row.checksum}`, row.id])
  )
  const missingRows = rawRows.filter(
    (row) => !byKey.has(`${row.source_id}:${row.checksum}`)
  )

  if (missingRows.length > 0) {
    const insertedRows = await insertRowsInChunks({
      admin,
      rows: missingRows,
      select: "id,source_id,checksum",
      size: RECORD_WRITE_CHUNK_SIZE,
      table: "resource_map_raw_ingestion_records",
    })
    for (const row of insertedRows) {
      byKey.set(`${row.source_id}:${row.checksum}`, row.id)
    }
  }

  return byKey
}

export async function fetchExistingImportRecords(
  admin,
  sourceId,
  payload,
  refreshExisting
) {
  const select =
    "id,source_record_id,source_url,batch_id,promotion_status,review_status,extracted_fields"
  if (refreshExisting) {
    const rows = []
    let cursor = null
    while (true) {
      const { data, error } = await retryTransientFetch(() => {
        let query = admin
          .from("resource_map_import_records")
          .select(select)
          .eq("source_id", sourceId)
          .order("id", { ascending: true })
        if (cursor) query = query.gt("id", cursor)
        return query.limit(500)
      })
      if (error) throw error
      if (!data?.length) return rows
      const nextCursor = data.at(-1)?.id
      if (!nextCursor || (cursor && nextCursor <= cursor)) {
        throw new Error("Import refresh lookup did not advance its cursor.")
      }
      rows.push(...data)
      cursor = nextCursor
      // Continue to an empty page: the server may cap below the requested limit.
    }
  }
  const sourceRecordIds = [
    ...new Set(payload.map((row) => row.source_record_id).filter(Boolean)),
  ]
  const existingRows = []
  for (const idChunk of chunkValues(sourceRecordIds, LOOKUP_CHUNK_SIZE)) {
    const { data, error } = await retryTransientFetch(() =>
      admin
        .from("resource_map_import_records")
        .select(select)
        .eq("source_id", sourceId)
        .in("source_record_id", idChunk)
        .order("updated_at", { ascending: false })
    )
    if (error) throw error
    existingRows.push(...(data ?? []))
  }
  return existingRows
}

function normalizedWebsiteKey(record) {
  const fields = readObject(record.extracted_fields)
  const value = readStringValue(
    fields.websiteUrl,
    fields.website_url,
    fields.website
  )
  if (!value) return null
  try {
    const url = new URL(value)
    if (!["http:", "https:"].includes(url.protocol)) return null
    url.hash = ""
    return url.toString().replace(/\/$/u, "").toLocaleLowerCase("en-US")
  } catch {
    return null
  }
}

export function resolveExistingAssignments(
  existingRecords,
  payload,
  refreshExisting
) {
  const bySourceRecordId = new Map()
  const byWebsite = new Map()
  const incomingWebsiteCounts = new Map()
  const incomingSourceIds = new Set()
  for (const candidate of payload) {
    if (candidate.source_record_id) {
      if (incomingSourceIds.has(candidate.source_record_id)) {
        throw new Error("Import input contains duplicate source record IDs.")
      }
      incomingSourceIds.add(candidate.source_record_id)
    }
    const key = normalizedWebsiteKey(candidate)
    if (key) incomingWebsiteCounts.set(key, (incomingWebsiteCounts.get(key) ?? 0) + 1)
  }
  for (const record of existingRecords) {
    if (
      record.source_record_id &&
      !bySourceRecordId.has(record.source_record_id)
    ) {
      bySourceRecordId.set(record.source_record_id, record)
    }
    if (refreshExisting && record.promotion_status !== "promoted") {
      const websiteKey = normalizedWebsiteKey(record)
      if (websiteKey) {
        const matches = byWebsite.get(websiteKey) ?? []
        matches.push(record)
        byWebsite.set(websiteKey, matches)
      }
    }
  }
  return payload.map((candidate) => {
    const exact = candidate.source_record_id
      ? bySourceRecordId.get(candidate.source_record_id)
      : null
    if (exact) return { record: exact, reconciled: false }
    if (!refreshExisting) return null
    const websiteKey = normalizedWebsiteKey(candidate)
    const websiteMatches = websiteKey ? (byWebsite.get(websiteKey) ?? []) : []
    return websiteMatches.length === 1 &&
      incomingWebsiteCounts.get(websiteKey) === 1 &&
      !incomingSourceIds.has(websiteMatches[0].source_record_id)
      ? { record: websiteMatches[0], reconciled: true }
      : null
  })
}

export function summarizeExistingOnlyPlan(assignments) {
  const matched = assignments.flatMap((assignment, index) =>
    assignment ? [{ ...assignment, index }] : []
  )
  const refreshable = matched.filter(
    ({ record }) =>
      record.promotion_status === "not_promoted" &&
      record.review_status !== "approved"
  )
  return {
    matched,
    missing: assignments.length - matched.length,
    protected: matched.length - refreshable.length,
    refreshable,
  }
}

async function loadExistingOfficialSource(admin, sourceSlug) {
  const { data, error } = await retryTransientFetch(() =>
    admin
      .from("resource_map_sources")
      .select("id,slug,trust_level")
      .eq("slug", sourceSlug)
      .maybeSingle()
  )
  if (error) throw error
  if (!data) throw new Error(`Unknown resource source ${sourceSlug}.`)
  if (data.trust_level !== "official") {
    throw new Error(`${sourceSlug} is not marked as an official source.`)
  }
  return data
}

async function planExistingOnlyRefresh(admin, rows, source) {
  const payload = rows.map((row) =>
    buildImportRecord(row, source.id, null, null)
  )
  const existingRecords = await fetchExistingImportRecords(
    admin,
    source.id,
    payload,
    true
  )
  const assignments = resolveExistingAssignments(existingRecords, payload, true)
  return summarizeExistingOnlyPlan(assignments)
}

async function refreshExistingAssignments(admin, assignments, payload) {
  let refreshed = 0
  let reconciled = 0
  for (let index = 0; index < assignments.length; index += 1) {
    const assignment = assignments[index]
    if (!assignment) continue
    if (
      assignment.record.promotion_status === "promoted" ||
      assignment.record.promotion_status === "ready" ||
      assignment.record.review_status === "approved"
    ) {
      continue
    }
    const {
      promotion_status: _promotionStatus,
      review_status: _reviewStatus,
      ...patch
    } = payload[index]
    const { data, error } = await retryTransientFetch(() =>
      admin
        .from("resource_map_import_records")
        .update(patch)
        .eq("id", assignment.record.id)
        .eq("promotion_status", "not_promoted")
        .neq("review_status", "approved")
        .select("id")
        .maybeSingle()
    )
    if (error) throw error
    if (!data) continue
    refreshed += 1
    if (assignment.reconciled) reconciled += 1
  }
  return { reconciled, refreshed }
}

function evidenceIdentity(row) {
  let fieldValue
  try {
    fieldValue = JSON.stringify(row.field_value)
  } catch {
    fieldValue = String(row.field_value ?? "")
  }
  return [
    row.import_record_id,
    row.field_path,
    row.source_url ?? "",
    row.transformation ?? "",
    fieldValue,
  ].join("\u0000")
}

async function filterMissingEvidence(admin, evidenceRows) {
  if (evidenceRows.length === 0) return []
  const importRecordIds = [
    ...new Set(evidenceRows.map((row) => row.import_record_id)),
  ]
  const existingKeys = new Set()
  for (const idChunk of chunkValues(importRecordIds, LOOKUP_CHUNK_SIZE)) {
    const { data, error } = await retryTransientFetch(() =>
      admin
        .from("resource_map_field_evidence")
        .select(
          "import_record_id,field_path,field_value,source_url,transformation"
        )
        .in("import_record_id", idChunk)
    )
    if (error) throw error
    for (const row of data ?? []) existingKeys.add(evidenceIdentity(row))
  }
  return evidenceRows.filter((row) => !existingKeys.has(evidenceIdentity(row)))
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const input = args.get("input")
  const dryRun = Boolean(args.get("dry-run"))
  const refreshExisting = Boolean(args.get("refresh-existing"))
  const existingOnly = Boolean(args.get("existing-only"))
  const apply = Boolean(args.get("apply"))
  const sourceSlug = String(args.get("source-slug") ?? "").trim()
  const confirmedSource = String(args.get("confirm-source") ?? "").trim()

  if (!input) {
    throw new Error(
      "Usage: pnpm resource-map:import -- --input records.jsonl|records.json --source-slug source --source-name 'Source Name' [--refresh-existing] [--existing-only] [--dry-run]"
    )
  }
  if (existingOnly && !refreshExisting) {
    throw new Error("--existing-only requires --refresh-existing.")
  }
  if (existingOnly && !sourceSlug) {
    throw new Error("--source-slug is required with --existing-only.")
  }
  if (existingOnly && !dryRun) {
    if (!apply) throw new Error("--apply is required to refresh existing rows.")
    if (confirmedSource !== sourceSlug) {
      throw new Error("--confirm-source must exactly match --source-slug.")
    }
  }

  const inputRows = readResourceMapRecords(input)
  let rows = existingOnly
    ? selectExistingOnlyRows(inputRows, sourceSlug)
    : inputRows
  let admin
  let existingSource
  if (existingOnly) {
    if (rows.length === 0) {
      throw new Error(
        `No publishable ${sourceSlug} records were found in the input.`
      )
    }
    admin = createResourceMapAdminClient()
    existingSource = await loadExistingOfficialSource(admin, sourceSlug)
    const plan = await planExistingOnlyRefresh(admin, rows, existingSource)
    console.log(
      `Existing-only plan: ${plan.refreshable.length}/${rows.length} publishable ${sourceSlug} records can refresh existing unapproved staging rows; missing ${plan.missing}; protected ${plan.protected}.`
    )
    for (const assignment of plan.refreshable.slice(0, 5)) {
      console.log(
        `- refresh ${assignment.record.id} - ${assignment.record.source_record_id}`
      )
    }
    if (plan.refreshable.length === 0) {
      throw new Error("No existing staging rows are eligible for refresh.")
    }
    if (plan.refreshable.length > MAX_EXISTING_ONLY_REFRESH) {
      throw new Error(
        `An existing-only refresh may contain at most ${MAX_EXISTING_ONLY_REFRESH} records.`
      )
    }
    if (plan.protected > 0) {
      throw new Error(
        "Existing-only refresh refuses inputs that match approved, ready, or promoted staging rows."
      )
    }
    rows = plan.refreshable.map(({ index }) => rows[index])
  }
  if (dryRun) {
    const rawSummary = summarizeRawPlan(rows, input, args)
    console.log(
      `Dry run: parsed ${rows.length} resource records from ${input}.`
    )
    console.log(
      `Dry run: would preserve ${rawSummary.rawCount} raw payloads and stage run ${rawSummary.runId}.`
    )
    return
  }

  admin ??= createResourceMapAdminClient()
  const sourceId = existingOnly
    ? existingSource.id
    : await upsertSource(admin, args)
  const ingestionRun = await upsertIngestionRun(admin, {
    args,
    input,
    rows,
    sourceId,
  })
  const { data: batch, error: batchError } = await admin
    .from("resource_map_import_batches")
    .insert({
      source_id: sourceId,
      import_kind: args.get("import-kind") || "full",
      status: "running",
      source_uri: input,
      row_count: rows.length,
    })
    .select("id")
    .maybeSingle()

  if (batchError) {
    await finishIngestionRun(admin, ingestionRun.id, {
      status: "failed",
      errors: [{ message: batchError.message }],
    })
    throw batchError
  }
  if (!batch) throw new Error("Unable to create import batch.")

  const rawPlan = buildRawIngestionPlan(rows, {
    sourceId,
    runDbId: ingestionRun.id,
    batchId: batch.id,
    input,
  })
  let rawIdsByKey
  try {
    rawIdsByKey = await upsertRawIngestionRecords(admin, rawPlan.rawRows)
  } catch (error) {
    await markBatchFailed(admin, batch.id, error.message, rows.length)
    await finishIngestionRun(admin, ingestionRun.id, {
      status: "failed",
      errors: [{ message: error.message }],
    })
    throw error
  }

  const payload = rows.map((row, index) =>
    buildImportRecord(
      row,
      sourceId,
      batch.id,
      rawIdsByKey.get(rawPlan.keyByIndex[index])
    )
  )
  const flaggedCount = payload.filter(
    (row) =>
      row.needs_review ||
      row.quality_flags.length > 0 ||
      (row.confidence_score !== null && row.confidence_score < 70)
  ).length
  let importRecords
  let insertedRecordCount = 0
  let refreshedRecordCount = 0
  let reconciledRecordCount = 0
  try {
    const existingRecords = await fetchExistingImportRecords(
      admin,
      sourceId,
      payload,
      refreshExisting
    )
    const assignments = resolveExistingAssignments(
      existingRecords,
      payload,
      refreshExisting
    )
    if (refreshExisting) {
      const refreshed = await refreshExistingAssignments(
        admin,
        assignments,
        payload
      )
      refreshedRecordCount = refreshed.refreshed
      reconciledRecordCount = refreshed.reconciled
    }
    const missingIndexes = assignments.flatMap((assignment, index) =>
      assignment ? [] : [index]
    )
    if (existingOnly && missingIndexes.length > 0) {
      throw new Error(
        "Existing staging rows changed after preflight; no new import records were inserted."
      )
    }
    const missingPayload = missingIndexes.map((index) => payload[index])
    const insertedRecords = await insertRowsInChunks({
      admin,
      rows: missingPayload,
      select: "id,source_record_id,source_url,batch_id",
      size: RECORD_WRITE_CHUNK_SIZE,
      table: "resource_map_import_records",
    })
    insertedRecordCount = insertedRecords.length
    const insertedBySourceRecordId = new Map()
    for (const record of insertedRecords) {
      if (record.source_record_id) {
        insertedBySourceRecordId.set(record.source_record_id, record)
      }
    }
    const insertedWithoutSourceId = insertedRecords.filter(
      (record) => !record.source_record_id
    )
    importRecords = payload.map((record, index) => {
      if (assignments[index]) return assignments[index].record
      if (record.source_record_id) {
        return insertedBySourceRecordId.get(record.source_record_id)
      }
      return insertedWithoutSourceId.shift()
    })
    if (importRecords.some((record) => !record)) {
      throw new Error("Unable to resolve every staged import record.")
    }
  } catch (error) {
    await markBatchFailed(admin, batch.id, error.message, rows.length)
    await finishIngestionRun(admin, ingestionRun.id, {
      status: "failed",
      errors: [{ message: error.message }],
    })
    throw error
  }

  const desiredEvidencePayload = importRecords.flatMap((importRecord, index) =>
    buildFieldEvidenceRecords(rows[index] ?? {}, importRecord, sourceId)
  )
  let evidencePayload
  try {
    evidencePayload = await filterMissingEvidence(admin, desiredEvidencePayload)
  } catch (error) {
    await markBatchFailed(admin, batch.id, error.message, rows.length)
    await finishIngestionRun(admin, ingestionRun.id, {
      status: "failed",
      errors: [{ message: error.message }],
    })
    throw error
  }

  if (evidencePayload.length > 0) {
    try {
      await insertRowsInChunks({
        admin,
        rows: evidencePayload,
        select: null,
        size: EVIDENCE_WRITE_CHUNK_SIZE,
        table: "resource_map_field_evidence",
      })
    } catch (error) {
      await admin
        .from("resource_map_import_batches")
        .update({
          status: "completed_with_errors",
          imported_count: payload.length,
          error_count: evidencePayload.length,
          error_log: [{ message: error.message }],
          completed_at: new Date().toISOString(),
        })
        .eq("id", batch.id)
      await finishIngestionRun(admin, ingestionRun.id, {
        status: "completed_with_errors",
        fetched_count: rawPlan.rawRows.length,
        parsed_count: rows.length,
        normalized_count: payload.length,
        classified_count: payload.length,
        errors: [{ message: error.message }],
      })
      throw error
    }
  }

  await admin
    .from("resource_map_import_batches")
    .update({
      status: "completed",
      imported_count: payload.length,
      summary: {
        fieldEvidenceCount: evidencePayload.length,
        flaggedCount,
        rawIngestionRecordCount: rawPlan.rawRows.length,
        rawIngestionDuplicateCount: rows.length - rawPlan.rawRows.length,
        resumedImportRecordCount: payload.length - insertedRecordCount,
      },
      completed_at: new Date().toISOString(),
    })
    .eq("id", batch.id)

  await finishIngestionRun(admin, ingestionRun.id, {
    status: "completed",
    fetched_count: rawPlan.rawRows.length,
    parsed_count: rows.length,
    normalized_count: payload.length,
    classified_count: payload.length,
    deduped_count: payload.length - insertedRecordCount,
    flagged_count: flaggedCount,
    errors: [],
  })

  console.log(
    `Staged ${payload.length} resource records (${insertedRecordCount} new, ${payload.length - insertedRecordCount} resumed, ${refreshedRecordCount} refreshed, ${reconciledRecordCount} reconciled by provider URL), preserved ${rawPlan.rawRows.length} raw payloads, and added ${evidencePayload.length} field evidence rows.`
  )
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(error.message)
    process.exit(1)
  })
}
