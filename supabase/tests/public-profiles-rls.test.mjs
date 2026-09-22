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

const root = process.cwd()
const postgresDirectory = process.env.POSTGRES_BINDIR?.trim() || resolvePgBin()
const dataDirectory = mkdtempSync(join(tmpdir(), "ch-public-profiles-"))
const port = String(61_000 + (process.pid % 3_000))
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
    ) {
      return candidate
    }
  }

  throw new Error(
    "PostgreSQL server tools are required. Set POSTGRES_BINDIR to the directory containing initdb, pg_ctl, postgres, and psql."
  )
}

function binary(name) {
  const path = join(postgresDirectory, name)
  accessSync(path, constants.X_OK)
  return path
}

function run(name, args, options = {}) {
  const result = spawnSync(binary(name), args, {
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

  runSql("supabase/tests/public-profiles-rls.bootstrap.sql")
  runSql("supabase/migrations/20260831213000_add_public_profile_foundation.sql")
  runSql(
    "supabase/migrations/20260901012000_add_public_profile_affiliations_activity.sql"
  )
  runSql("supabase/migrations/20260901013000_add_tracked_resource_links.sql")
  runSql("supabase/migrations/20260901014000_add_public_saved_collections.sql")
  runSql("supabase/tests/public-profiles-rls.assertions.sql")
  runSql("supabase/tests/profile-settings.bootstrap.sql")
  runSql("supabase/migrations/20260914180000_complete_profile_settings.sql")
  runSql("supabase/migrations/20260914180000_complete_profile_settings.sql")
  runSql("supabase/tests/profile-settings.assertions.sql")

  console.log(
    "[public-profiles] Global collisions, privacy, verified affiliations, allowlisted activity, tracked-link privacy, public saved collections, deduplicated opens, membership revocation, organization sync, and direct-write denial passed."
  )
} finally {
  if (started) {
    spawnSync(binary("pg_ctl"), [
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
