#!/usr/bin/env node

import {
  accessSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  constants,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { execFileSync, spawnSync } from "node:child_process"

const root = process.cwd()
const postgresDirectory = process.env.POSTGRES_BINDIR?.trim() || resolvePgBin()
const dataDirectory = mkdtempSync(join(tmpdir(), "ch-fiscal-rls-"))
const port = String(56_000 + (process.pid % 5_000))
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

  if (process.argv.includes("--guest")) {
    runSql("supabase/tests/guest-fiscal-submission.bootstrap.sql")
    runSql("supabase/migrations/20260920150000_project_option_settings.sql")
    runSql("supabase/migrations/20260609154000_add_fiscal_sponsorship_applications.sql")
    runSql("supabase/migrations/20261010100000_guest_fiscal_submission.sql")
    runSql("supabase/migrations/20261015200000_fix_fiscal_project_options.sql")
    runSql("supabase/migrations/20261015200000_fix_fiscal_project_options.sql") // Retry must be a no-op.
    runSql("supabase/migrations/20261010120000_fiscal_staff_event_notifications.sql")
    runSql("supabase/migrations/20261012160000_guest_fiscal_submission_notifications.sql")
    runSql("supabase/tests/guest-fiscal-submission.assertions.sql")
    runSql("supabase/tests/fiscal-staff-notifications.assertions.sql")
    runSql("supabase/tests/guest-fiscal-reviewer-scope.bootstrap.sql")
    runSql("supabase/migrations/20261010130000_guest_fiscal_reviewer_scope.sql")
    runSql("supabase/migrations/20261010140000_guest_fiscal_project_views.sql")
    runSql("supabase/tests/guest-fiscal-project-views.assertions.sql")
    runSql("supabase/migrations/20261010150000_guest_fiscal_delivery.sql")
    runSql("supabase/tests/guest-fiscal-delivery.assertions.sql")
    runSql("supabase/migrations/20261010160000_guest_fiscal_drafts.sql")
    runSql("supabase/tests/guest-fiscal-drafts.assertions.sql")
    runSql("supabase/migrations/20261010170000_guest_fiscal_email_proof.sql")
    runSql("supabase/tests/guest-fiscal-email-proof.assertions.sql")
    runSql("supabase/tests/guest-fiscal-profile-claim.bootstrap.sql")
    if (!process.argv.includes("--release-mvp")) {
      runSql("supabase/migrations/20261010180000_guest_fiscal_profile_claim.sql")
      runSql("supabase/tests/guest-fiscal-profile-claim.assertions.sql")
    }
    runSql("supabase/tests/guest-fiscal-reviewer-scope.assertions.sql")
    runSql("supabase/migrations/20261011090000_guest_fiscal_followup.sql")
    runSql("supabase/migrations/20261011100000_guest_fiscal_followup_notifications.sql")
    runSql("supabase/tests/guest-fiscal-followup.assertions.sql")
    runSql("supabase/migrations/20261011110000_guest_fiscal_recovery.sql")
    runSql("supabase/tests/guest-fiscal-recovery.assertions.sql")
    runSql("supabase/migrations/20261011120000_fiscal_email_delivery_tracking.sql")
    runSql("supabase/tests/fiscal-email-delivery.assertions.sql")
    runSql("supabase/tests/guest-fiscal-related-records.bootstrap.sql")
    runSql("supabase/migrations/20261011130000_guest_fiscal_related_records.sql")
    runSql("supabase/tests/guest-fiscal-related-records.assertions.sql")
    runSql("supabase/migrations/20261015040000_fiscal_linked_applicant_access.sql")
    runSql("supabase/migrations/20261015041000_index_linked_fiscal_applications.sql")
    if (!process.argv.includes("--release-mvp")) runSql("supabase/tests/fiscal-linked-applicant.assertions.sql")
    runSql("supabase/tests/guest-fiscal-browser-return.bootstrap.sql")
    runSql("supabase/migrations/20261015210000_fiscal_receipt_copy_and_browser_return.sql")
    runSql("supabase/tests/guest-fiscal-receipt-copy.assertions.sql")
    runSql("supabase/tests/fiscal-review-task.bootstrap.sql")
    runSql("supabase/migrations/20261016200000_fiscal_review_tasks_and_cc.sql")
    runSql("supabase/tests/fiscal-review-task.assertions.sql")
    if (!process.argv.includes("--release-mvp")) {
      runSql("supabase/migrations/20261020230000_fiscal_organization_link.sql")
      runSql("supabase/tests/fiscal-organization-link.assertions.sql")
      runSql("supabase/tests/fiscal-reviewer-assets.bootstrap.sql")
      runSql("supabase/migrations/20261020231000_fiscal_reviewer_asset_upload.sql")
      runSql("supabase/tests/fiscal-reviewer-assets.assertions.sql")
    }
    if (process.argv.includes("--connected")) {
      const connected = spawnSync("pnpm", ["exec", "vitest", "run", "tests/acceptance/fiscal-sponsorship-connected-storage.test.ts", "--maxWorkers=1", "--config", "vitest.config.ts"], {
        cwd: root, encoding: "utf8", timeout: 90000,
        env: { ...process.env, FISCAL_STORAGE_TEST: "ephemeral", FISCAL_STORAGE_TEST_PORT: port, FISCAL_STORAGE_TEST_PSQL: binary("psql") },
      })
      if (connected.status !== 0) throw new Error(`Connected storage test failed:\n${connected.stdout}\n${connected.stderr}`)
      console.log(connected.stdout)
    }
    console.log("[guest-fiscal] Atomic project/application/assignment/outbox and denial tests passed.")
  } else {
  runSql("supabase/tests/fiscal-final-schema-rls.bootstrap.sql")
  runSql("supabase/migrations/20260806010000_harden_fiscal_sponsorship_rls.sql")
  runSql("supabase/tests/fiscal-final-schema-rls.assertions.sql")

  runSql("supabase/tests/public-fiscal-intake.bootstrap.sql")
  runSql("supabase/migrations/20260920150000_project_option_settings.sql")
  runSql("supabase/migrations/20260505120000_gate_member_workspace_paid_access.sql")
  runSql("supabase/migrations/20261010090000_public_fiscal_intake.sql")
  runSql("supabase/migrations/20261015200000_fix_fiscal_project_options.sql")
  runSql("supabase/migrations/20261015200000_fix_fiscal_project_options.sql")
  runSql("supabase/tests/public-fiscal-intake.assertions.sql")

  console.log("[fiscal-intake] Anonymous denial, owner isolation, profile preservation and idempotent start passed.")
  console.log(
    "[fiscal-rls] Final-schema role matrix passed for owner, staff, board, sponsor operator, assigned coach, unassigned coach, and unrelated user."
  )
  // The required fiscal RLS command also covers the existing guest harness and
  // real handlers; a default green check must not silently skip applicant grants.
  const guest = spawnSync(process.execPath, [join(root, "supabase/tests/fiscal-final-schema-rls.test.mjs"), "--guest", "--connected"], {
    cwd: root, encoding: "utf8", timeout: 120000, env: process.env,
  })
  if (guest.status !== 0) throw new Error(`Guest fiscal RLS failed:\n${guest.stdout}\n${guest.stderr}`)
  console.log(guest.stdout)
  }
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
