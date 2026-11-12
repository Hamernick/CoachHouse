#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process"
import {
  accessSync,
  constants,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { verifyLegacyCleanupRaces } from "./legacy-document-cleanup-races.mjs"
import { verifyCoreUploadRaces } from "./core-upload-tracking-races.mjs"

const root = process.cwd()
const postgresDirectory = process.env.POSTGRES_BINDIR?.trim() || resolvePgBin()
const dataDirectory = mkdtempSync(join(tmpdir(), "ch-document-files-rls-"))
const port = String(58_000 + (process.pid % 1_000))
const socketDirectory = "/tmp"

function resolvePgBin() {
  const candidates = []
  try {
    candidates.push(
      execFileSync("pg_config", ["--bindir"], { encoding: "utf8" }).trim()
    )
  } catch {}
  for (const formula of [
    "postgresql",
    "postgresql@18",
    "postgresql@17",
    "postgresql@16",
    "postgresql@15",
    "postgresql@14",
  ]) {
    try {
      candidates.push(
        join(
          execFileSync("brew", ["--prefix", formula], {
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"],
          }).trim(),
          "bin"
        )
      )
    } catch {}
  }
  for (const candidate of candidates) {
    if (
      ["initdb", "pg_ctl", "postgres", "psql"].every((name) => {
        try {
          accessSync(join(candidate, name), constants.X_OK)
          return true
        } catch {
          return false
        }
      })
    )
      return candidate
  }
  throw new Error("PostgreSQL server tools are required. Set POSTGRES_BINDIR.")
}

function run(name, args, options = {}) {
  const result = spawnSync(join(postgresDirectory, name), args, {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, LC_ALL: "C" },
    ...options,
  })
  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n")
    throw new Error(`${name} failed${output ? `:\n${output}` : ""}`)
  }
  return result
}

function runSql(path) {
  return run(
    "psql",
    [
      "-h",
      socketDirectory,
      "-p",
      port,
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-q",
    ],
    { input: readFileSync(join(root, path), "utf8") }
  )
}

let started = false
try {
  run("initdb", ["-D", dataDirectory, "-A", "trust", "-U", "postgres"])
  run("pg_ctl", [
    "-D",
    dataDirectory,
    "-o",
    `-F -k ${socketDirectory} -p ${port}`,
    "-l",
    join(dataDirectory, "postgres.log"),
    "-w",
    "start",
  ])
  started = true
  runSql("supabase/tests/organization-document-files-rls.bootstrap.sql")
  runSql(
    "supabase/migrations/20260904113000_add_organization_document_library.sql"
  )
  runSql("supabase/tests/organization-document-files-rls.assertions.sql")
  runSql("supabase/migrations/20260904183000_count_policy_document_storage.sql")
  runSql("supabase/tests/organization-policy-document-storage.assertions.sql")
  runSql("supabase/tests/free-workspace-access.bootstrap.sql")
  runSql("supabase/migrations/20261012163000_gate_free_workspace_document_writes.sql")
  runSql("supabase/tests/free-workspace-access.assertions.sql")
  runSql("supabase/tests/organization-brand-kits.bootstrap.sql")
  runSql("supabase/migrations/20261021200000_private_organization_brand_kits.sql")
  runSql("supabase/tests/organization-brand-kits.assertions.sql")
  const sqlArgs = ["-h", socketDirectory, "-p", port, "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-qAt"]
  const actorSource = readFileSync(join(root, "supabase/migrations/20260921002000_preserve_document_activity_actor.sql"), "utf8")
  run("psql", sqlArgs, { input: actorSource.slice(0, actorSource.indexOf("create or replace function public.record_organization_document_activity")) })
  runSql("supabase/tests/core-upload-tracking.bootstrap.sql")
  runSql("supabase/migrations/20261111010000_atomic_core_upload_tracking.sql")
  runSql("supabase/tests/core-upload-tracking.assertions.sql")
  await verifyCoreUploadRaces({ psql: join(postgresDirectory, "psql"), args: sqlArgs, env: { ...process.env, LC_ALL: "C" } })
  const closureSource = readFileSync(join(root, "supabase/migrations/20261103400000_organization_closure_asset_cleanup.sql"), "utf8")
  run("psql", sqlArgs, { input: closureSource.slice(closureSource.indexOf("create function public.closure_asset_reference_text"), closureSource.indexOf("create function public.closure_asset_matches_binding")) })
  runSql("supabase/tests/legacy-document-retirement.bootstrap.sql")
  runSql("supabase/migrations/20261111020000_retain_legacy_document_identities.sql")
  runSql("supabase/tests/legacy-document-retirement.assertions.sql")
  await verifyCoreUploadRaces({ psql: join(postgresDirectory, "psql"), args: sqlArgs, env: { ...process.env, LC_ALL: "C" } })
  runSql("supabase/tests/legacy-document-cleanup.bootstrap.sql")
  const cleanupSource = readFileSync(join(root, "supabase/migrations/20261103280000_document_file_version_cleanup.sql"), "utf8")
  run("psql", sqlArgs, { input: cleanupSource.slice(cleanupSource.indexOf("create function public.assert_document_cleanup_authority"), cleanupSource.indexOf("create function public.guard_document_purge_mutation")) })
  run("psql", sqlArgs, { input: cleanupSource.slice(cleanupSource.indexOf("create function public.document_retained_source_bytes"), cleanupSource.indexOf("\ndo $$", cleanupSource.indexOf("create function public.document_retained_source_bytes"))) })
  runSql("supabase/migrations/20261111030000_legacy_document_cleanup.sql")
  runSql("supabase/migrations/20261111040000_legacy_cleanup_actor_context.sql")
  runSql("supabase/tests/legacy-document-cleanup.assertions.sql")
  await verifyLegacyCleanupRaces({ psql: join(postgresDirectory, "psql"), args: sqlArgs, env: { ...process.env, LC_ALL: "C" } })
  console.log("[legacy-document-cleanup] Outstanding replacement quota, durable retries, retained references, revocation and private ACLs passed.")
  console.log("[legacy-document-retirement] Core/policy IDs, dependent references, byte accounting, stale cleanup and re-upload passed.")
  console.log("[core-upload-tracking] Stable backfill, atomic rename/replacement, quota rollback, source validation, private helpers and deferred physical cleanup passed.")
  console.log("[organization-brand-kits] Private reads, editor roles, atomic saves, stale revisions, and unavailable assets passed.")
  console.log("[free-workspace-access] Reads, Drive links, profile edits, paid writes, tenant isolation, and free write restrictions passed.")
  console.log(
    "[organization-document-files-rls] Tenant access, existing per-file limit, arbitrary MIME types, and 5 GB quota passed."
  )
} finally {
  if (started) {
    spawnSync(join(postgresDirectory, "pg_ctl"), [
      "-D",
      dataDirectory,
      "-m",
      "fast",
      "-w",
      "stop",
    ])
  }
  rmSync(dataDirectory, { force: true, recursive: true })
}
