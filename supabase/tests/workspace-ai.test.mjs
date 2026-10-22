#!/usr/bin/env node

import { execFileSync, spawnSync, spawn } from "node:child_process"
import { accessSync, constants, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const root = process.cwd()
const postgresDirectory = process.env.POSTGRES_BINDIR?.trim() || resolvePgBin()
const dataDirectory = mkdtempSync(join(tmpdir(), "ch-workspace-ai-"))
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
  runSql("supabase/tests/workspace-ai.bootstrap.sql")
  runSql("supabase/migrations/20261022120000_workspace_ai_metering.sql")
  runSql("supabase/migrations/20261022121000_workspace_ai_read_and_recovery.sql")
  runSql("supabase/migrations/20261022123000_workspace_ai_durable_recovery.sql")
  runSql("supabase/migrations/20261022130000_workspace_ai_document_application.sql")
  runSql("supabase/tests/workspace-ai.assertions.sql")
  const args=["-h",socketDirectory,"-p",port,"-U","postgres","-d","postgres","-v","ON_ERROR_STOP=1","-q"]
  run("psql",args,{input:`
    update public.ai_credit_policy set daily_provider_microdollars=10000000;
    insert into public.ai_credit_wallets(org_id,enabled) values('00000000-0000-0000-0000-000000000004',true);
    insert into public.organization_memberships values('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000002','staff');
    insert into public.ai_credit_lots(org_id,operation_key,kind,credits) values('00000000-0000-0000-0000-000000000004','race-fixture','purchased',50);
  `})
  const reserveConcurrently=(actor,suffix)=>new Promise(resolve=>{
    const child=spawn(join(postgresDirectory,"psql"),args,{stdio:["pipe","pipe","pipe"]})
    let error="";child.stderr.on("data",chunk=>{error+=chunk});child.stdout.resume()
    child.on("close",code=>resolve({code,error}))
    child.stdin.end(`begin; set local role service_role;
      select public.reserve_workspace_ai_run('30000000-0000-4000-8000-00000000000${suffix}',
      '00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-00000000000${actor}',repeat('f',64),'{}','race','{}',40,80000);
      select pg_sleep(0.15); commit;`)
  })
  const races=await Promise.all([reserveConcurrently(4,1),reserveConcurrently(2,2)])
  if(races.filter(result=>result.code===0).length!==1 || !races.some(result=>result.error.includes("Not enough AI credits")))
    throw new Error(`Wallet admission race failed: ${JSON.stringify(races)}`)
  run("psql",args,{input:`
    select public.assert_ai((select sum(r.credits)=40 from public.ai_credit_reservations r
      join public.workspace_ai_runs a on a.id=r.run_id where a.org_id='00000000-0000-0000-0000-000000000004'),'concurrent reservations cannot overspend');
    select public.cancel_workspace_ai_run(id,org_id,actor_id) from public.workspace_ai_runs where org_id='00000000-0000-0000-0000-000000000004';
    select public.settle_workspace_ai_run(id,'succeeded',12000,6,'<p>Finished after Stop</p>','{}','stopped') from public.workspace_ai_runs where org_id='00000000-0000-0000-0000-000000000004';
    select public.settle_workspace_ai_run(id,'succeeded',12000,6,'<p>Finished after Stop</p>','{}','stopped') from public.workspace_ai_runs where org_id='00000000-0000-0000-0000-000000000004';
    select public.assert_ai(status='canceled' and charged_credits=0 and proposal is null,'Stop wins before settlement') from public.workspace_ai_runs where org_id='00000000-0000-0000-0000-000000000004';
    select public.assert_ai((public.read_workspace_ai_account('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000004')->'lots'->0->>'reserved')::int=0,'settlement releases reservation');
    select public.assert_ai(public.read_workspace_ai_run('20000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000004') is null,'cross-org private proposal hidden');
  `})
  runSql("supabase/tests/workspace-ai-recovery.assertions.sql")
  runSql("supabase/tests/workspace-ai-application.assertions.sql")
  console.log("[workspace-ai] Accounting, access, cancellation, crash recovery, atomic document application/replay/rollback and real concurrent wallet admission passed.")
} finally {
  if (started) {
    spawnSync(join(postgresDirectory, "pg_ctl"), [
      "-D", dataDirectory, "-m", "fast", "-w", "stop",
    ])
  }
  rmSync(dataDirectory, { force: true, recursive: true })
}
