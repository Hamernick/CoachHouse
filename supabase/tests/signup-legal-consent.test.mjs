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
const dataDirectory = mkdtempSync(join(tmpdir(), "ch-signup-consent-"))
const port = String(58_000 + (process.pid % 3_000))
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

  runSql("supabase/tests/signup-legal-consent.bootstrap.sql")
  runSql("supabase/migrations/20260811160000_add_signup_legal_acceptances.sql")
  runSql("supabase/tests/signup-legal-consent-vulnerable.assertions.sql")
  runSql("supabase/migrations/20260814090000_enforce_signup_legal_consent.sql")
  runSql("supabase/tests/signup-legal-consent.assertions.sql")
  runSql("supabase/migrations/20260827131000_accept_google_auth_legal_consent.sql")
  runSql("supabase/tests/signup-legal-consent-current.assertions.sql")
  runSql("supabase/migrations/20260909150000_accept_calendar_privacy_consent.sql")
  runSql("supabase/tests/signup-legal-consent-calendar.assertions.sql")
  runSql("supabase/migrations/20260910120000_accept_drive_privacy_consent.sql")
  runSql("supabase/tests/signup-legal-consent-drive.assertions.sql")

  console.log(
    "[signup-consent] Consent enforcement, Drive/Calendar versions, prior-version compatibility and trusted provisioning pass in isolated PostgreSQL."
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
