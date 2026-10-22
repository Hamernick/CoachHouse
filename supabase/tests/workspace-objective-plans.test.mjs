#!/usr/bin/env node

import { execFileSync, spawnSync, spawn } from "node:child_process"
import { accessSync, constants, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const root = process.cwd()
const postgresDirectory = process.env.POSTGRES_BINDIR?.trim() || resolvePgBin()
const dataDirectory = mkdtempSync(join(tmpdir(), "ch-objective-plans-"))
const port = String(57_000 + (process.pid % 1_000))
const socketDirectory = "/tmp"

function resolvePgBin() {
  const candidates = []
  try {
    candidates.push(execFileSync("pg_config", ["--bindir"], { encoding: "utf8" }).trim())
  } catch {}
  for (const formula of ["postgresql", "postgresql@18", "postgresql@17", "postgresql@16", "postgresql@15", "postgresql@14"]) {
    try {
      candidates.push(join(execFileSync("brew", ["--prefix", formula], {
        encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
      }).trim(), "bin"))
    } catch {}
  }
  for (const candidate of candidates) {
    if (["initdb", "pg_ctl", "postgres", "psql"].every((name) => {
      try {
        accessSync(join(candidate, name), constants.X_OK)
        return true
      } catch {
        return false
      }
    })) return candidate
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
  return run("psql", [
    "-h", socketDirectory, "-p", port, "-U", "postgres", "-d", "postgres",
    "-v", "ON_ERROR_STOP=1", "-q",
  ], { input: readFileSync(join(root, path), "utf8") })
}

let started = false
try {
  run("initdb", ["-D", dataDirectory, "-A", "trust", "-U", "postgres"])
  run("pg_ctl", [
    "-D", dataDirectory,
    "-o", `-F -k ${socketDirectory} -p ${port}`,
    "-l", join(dataDirectory, "postgres.log"),
    "-w", "start",
  ])
  started = true
  runSql("supabase/tests/google-drive-rls.bootstrap.sql")
  runSql("supabase/tests/workspace-objective-plans.bootstrap.sql")
  runSql("supabase/migrations/20260227190000_add_workspace_objective_tables.sql")
  runSql("supabase/migrations/20261022150000_workspace_objective_plans.sql")
  runSql("supabase/migrations/20261022160000_workspace_plan_decisions.sql")
  runSql("supabase/tests/workspace-objective-plans.assertions.sql")
  runSql("supabase/tests/workspace-plan-decisions.assertions.sql")
  const args = ["-h",socketDirectory,"-p",port,"-U","postgres","-d","postgres","-v","ON_ERROR_STOP=1","-q"]
  const compete = title => new Promise(resolve => {
    const child = spawn(join(postgresDirectory,"psql"),args,{stdio:["pipe","pipe","pipe"]})
    let error = ""; child.stderr.on("data",chunk => { error += chunk }); child.stdout.resume()
    child.on("close",code => resolve({code,error}))
    child.stdin.end(`begin; set local role authenticated;
      select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
      select public.save_workspace_objective_plan('00000000-0000-0000-0000-000000000001',
        '{"id":"20000000-0000-4000-8000-000000000002","objectiveId":"10000000-0000-4000-8000-000000000002","revision":1,"title":"${title}","steps":[],"edges":[]}');
      select pg_sleep(0.15); commit;`)
  })
  const race = await Promise.all([compete("Concurrent A"),compete("Concurrent B")])
  if (race.filter(result => result.code === 0).length !== 1 || !race.some(result => result.error.includes("Plan changed"))) throw new Error(`Plan race failed: ${JSON.stringify(race)}`)
  console.log("[objective-plans] Scoped saves, shared steps, branches, CAS conflicts/concurrent writers, cycles and atomic rollback passed.")
} finally {
  if (started) run("pg_ctl", ["-D", dataDirectory, "-m", "immediate", "-w", "stop"])
  rmSync(dataDirectory, { recursive: true, force: true })
}
