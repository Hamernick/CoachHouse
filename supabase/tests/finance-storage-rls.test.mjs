#!/usr/bin/env node

import { execFileSync, spawnSync, spawn } from "node:child_process"
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
const dataDirectory = mkdtempSync(join(tmpdir(), "ch-finance-rls-"))
const port = String(61_000 + (process.pid % 4_000))
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

  runSql("supabase/tests/finance-storage-rls.bootstrap.sql")
  runSql(
    "supabase/migrations/20260807171000_add_organization_finance_records.sql"
  )
  runSql(
    "supabase/migrations/20260807172000_add_organization_finance_opportunities.sql"
  )
  runSql(
    "supabase/migrations/20260807173000_add_organization_finance_engagement_events.sql"
  )
  runSql(
    "supabase/migrations/20260808142000_add_finance_opportunity_source_registry.sql"
  )
  runSql(
    "supabase/migrations/20260808145500_link_finance_records_to_programs.sql"
  )
  runSql(
    "supabase/migrations/20260808163500_add_finance_record_reconciliation.sql"
  )
  runSql(
    "supabase/migrations/20260808175223_add_finance_record_corrections.sql"
  )
  runSql(
    "supabase/migrations/20260808201500_make_finance_opportunity_stages_factual.sql"
  )
  runSql(
    "supabase/migrations/20260808203000_add_finance_stripe_app_connection.sql"
  )
  runSql(
    "supabase/migrations/20260813153500_require_board_membership_for_finance_access.sql"
  )
  runSql(
    "supabase/migrations/20260814061500_bind_finance_stripe_install_to_authorized_org.sql"
  )
  runSql("supabase/tests/finance-storage-rls.assertions.sql")

  runSql("supabase/migrations/20261023223000_add_opportunity_sources.sql")
  runSql("supabase/migrations/20261024000000_add_opportunity_reports.sql")
  run("psql", ["-h", socketDirectory, "-p", port, "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-q"], {
    input: "create table public.organization_workspace_boards(org_id uuid primary key,state jsonb not null);",
  })
  runSql("supabase/migrations/20261025010000_resource_opportunity_matches.sql")
  runSql("supabase/tests/resource-opportunity-matches.assertions.sql")

  const raceArgs=["-h",socketDirectory,"-p",port,"-U","postgres","-d","postgres","-v","ON_ERROR_STOP=1","-q","-t","-A"]
  const racePayload=run("psql",raceArgs,{input:"select jsonb_build_object('id',id,'updatedAt',updated_at) from public.organization_resource_opportunity_matches limit 1;"}).stdout.trim()
  const dismissConcurrently=()=>new Promise(resolve=>{
    const child=spawn(binary("psql"),raceArgs,{stdio:["pipe","pipe","pipe"]})
    let error="";child.stderr.on("data",chunk=>{error+=chunk});child.stdout.resume()
    child.on("close",code=>resolve({code,error}))
    child.stdin.end(`begin; set local role service_role; select public.match_call('dismiss','00000000-0000-0000-0000-000000000001','${racePayload}'::jsonb); select pg_sleep(0.1); commit;`)
  })
  const race=await Promise.all([dismissConcurrently(),dismissConcurrently()])
  if(race.filter(result=>result.code===0).length!==1||!race.some(result=>result.error.includes("Match changed")))throw new Error(`Match CAS race failed: ${JSON.stringify(race)}`)

  console.log(
    "[finance-rls] Board access, membership revocation, cross-tenant, direct-write, verification, correction, Stripe provider evidence, and immutable-evidence checks passed."
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
