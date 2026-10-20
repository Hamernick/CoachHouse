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

import { verifyTaskPlanningConcurrency } from "./task-planning-concurrency.mjs"

const root = process.cwd()
const postgresDirectory = process.env.POSTGRES_BINDIR?.trim() || resolvePgBin()
const dataDirectory = mkdtempSync(join(tmpdir(), "ch-project-recurrence-"))
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
  runSql("supabase/tests/recurring-projects.bootstrap.sql")
  runSql("supabase/migrations/20260406183000_add_member_workspace_projects.sql")
  runSql("supabase/migrations/20260406194000_add_member_workspace_tasks.sql")
  runSql("supabase/tests/recurring-projects-support.bootstrap.sql")
  runSql("supabase/migrations/20260920150000_project_option_settings.sql")
  runSql("supabase/migrations/20260806005000_atomic_organization_project_status_updates.sql")
  runSql("supabase/migrations/20260806007000_atomic_organization_project_deletion.sql")
  runSql("supabase/migrations/20260920103000_confirm_project_schedules.sql")
  runSql("supabase/migrations/20260928090000_recurring_projects.sql")
  runSql("supabase/migrations/20260928150000_optional_project_dates_and_assignment.sql")
  runSql("supabase/migrations/20260928180000_require_monthly_project_dates.sql")
  runSql("supabase/tests/recurring-projects.assertions.sql")
  runSql("supabase/tests/optional-project-fields.assertions.sql")
  runSql("supabase/tests/task-assignment-notifications.bootstrap.sql")
  runSql("supabase/migrations/20260115210000_add_notifications.sql")
  runSql("supabase/migrations/20260116130000_extend_notifications.sql")
  runSql("supabase/migrations/20260805233500_atomic_organization_task_creation.sql")
  runSql("supabase/migrations/20260928160000_task_assignment_notifications.sql")
  runSql("supabase/migrations/20261020232000_personal_notification_privacy.sql")
  runSql("supabase/tests/task-assignment-notifications.assertions.sql")
  runSql("supabase/tests/personal-notification-privacy.assertions.sql")
  runSql("supabase/migrations/20261021010000_task_schedule_and_relative_order.sql")
  runSql("supabase/tests/task-planning.assertions.sql")
  await verifyTaskPlanningConcurrency({ postgresDirectory, port, socketDirectory })
  console.log("[recurring-projects] Month-end recurrence, idempotency, rollback, task copies, optional fields, assignment notifications, and RLS passed.")
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
