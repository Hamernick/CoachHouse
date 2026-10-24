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
  runSql("supabase/tests/workspace-objective-plans.bootstrap.sql")
  runSql("supabase/migrations/20260227190000_add_workspace_objective_tables.sql")
  runSql("supabase/migrations/20261022150000_workspace_objective_plans.sql")
  runSql("supabase/migrations/20261022160000_workspace_plan_decisions.sql")
  runSql("supabase/migrations/20261022120000_workspace_ai_metering.sql")
  runSql("supabase/migrations/20261022121000_workspace_ai_read_and_recovery.sql")
  runSql("supabase/migrations/20261022123000_workspace_ai_durable_recovery.sql")
  runSql("supabase/migrations/20261022130000_workspace_ai_document_application.sql")
  runSql("supabase/migrations/20261022140000_workspace_ai_document_review.sql")
  runSql("supabase/migrations/20261022170000_workspace_ai_plans.sql")
  runSql("supabase/migrations/20261022230000_workspace_ai_plan_revisions.sql")
  runSql("supabase/migrations/20261022233000_workspace_ai_credit_purchases.sql")
  runSql("supabase/migrations/20261022234500_workspace_ai_spending_limits.sql")
  runSql("supabase/migrations/20261023001500_workspace_ai_payment_restrictions.sql")
  runSql("supabase/migrations/20261023010000_workspace_ai_usage_history.sql")
  runSql("supabase/migrations/20261023020000_workspace_ai_subscription_allowances.sql")
  runSql("supabase/migrations/20261024010000_workspace_particle_research.sql")
  runSql("supabase/tests/workspace-ai.assertions.sql")
  runSql("supabase/tests/workspace-research.assertions.sql")
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
  runSql("supabase/tests/workspace-ai-plans.assertions.sql")
  runSql("supabase/tests/workspace-ai-plan-revisions.assertions.sql")
  runSql("supabase/tests/workspace-ai-purchases.assertions.sql")
  const applyConcurrently = () => new Promise(resolve => {
    const child = spawn(join(postgresDirectory,"psql"),args,{stdio:["pipe","pipe","pipe"]})
    let error = ""; child.stderr.on("data",chunk => { error += chunk }); child.stdout.resume()
    child.on("close",code => resolve({code,error}))
    child.stdin.end(`begin; set local role authenticated;
      select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
      select public.apply_workspace_ai_plan('00000000-0000-0000-0000-000000000001','62000000-0000-4000-8000-000000000006');
      select pg_sleep(0.15); commit;`)
  })
  const applies = await Promise.all([applyConcurrently(), applyConcurrently()])
  if (applies.some(result => result.code !== 0)) throw new Error(`Concurrent plan apply failed: ${JSON.stringify(applies)}`)
  run("psql",args,{input:`select public.assert_ai((select count(*)=1 from public.workspace_ai_plan_applications where run_id='62000000-0000-4000-8000-000000000006'),'concurrent apply commits one receipt');
    select public.assert_ai((select count(*)=1 from public.workspace_objective_plans where id='62000000-0000-4000-8000-000000000006'),'concurrent apply commits one plan');`})
  const reviseConcurrently = n => new Promise(resolve => {
    const child = spawn(join(postgresDirectory,"psql"),args,{stdio:["pipe","pipe","pipe"]})
    let error = ""; child.stderr.on("data",chunk => { error += chunk }); child.stdout.resume()
    child.on("close",code => resolve({code,error}))
    child.stdin.end(`begin; set local role authenticated;
      select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
      select public.apply_workspace_ai_plan('00000000-0000-0000-0000-000000000001','62000000-0000-4000-8000-0000000000${n}');
      select pg_sleep(0.15); commit;`)
  })
  const revisions = await Promise.all([reviseConcurrently(25),reviseConcurrently(26)])
  if (revisions.filter(result => result.code === 0).length !== 1 || !revisions.some(result => result.error.includes("Plan or steps changed"))) throw new Error(`Concurrent revisions failed: ${JSON.stringify(revisions)}`)
  run("psql",args,{input:`select public.assert_ai((select count(*)=1 from public.workspace_ai_plan_applications where run_id in('62000000-0000-4000-8000-000000000025','62000000-0000-4000-8000-000000000026')),'one concurrent revision commits');`})
  const fulfillConcurrently = () => new Promise(resolve => {
    const child = spawn(join(postgresDirectory,"psql"),args,{stdio:["pipe","pipe","pipe"]})
    let error = ""; child.stderr.on("data",chunk => { error += chunk }); child.stdout.resume()
    child.on("close",code => resolve({code,error}))
    child.stdin.end(`begin; set local role service_role;
      select public.fulfill_ai_credit_purchase('71000000-0000-4000-8000-000000000002','cs_race','pi_race','test',1000,'usd');
      select pg_sleep(0.15); commit;`)
  })
  const payments = await Promise.all([fulfillConcurrently(), fulfillConcurrently()])
  if (payments.some(result => result.code !== 0)) throw new Error(`Concurrent credit fulfillment failed: ${JSON.stringify(payments)}`)
  run("psql",args,{input:`select public.assert_ai((select count(*)=1 from public.ai_credit_lots where operation_key='stripe-credit:test:pi_race'),'concurrent payment delivery grants once');`})
  runSql("supabase/tests/workspace-ai-limits.assertions.sql")
  const reserveWithCaps = n => new Promise(resolve => {
    const child = spawn(join(postgresDirectory,"psql"),args,{stdio:["pipe","pipe","pipe"]})
    let error = ""; child.stderr.on("data",chunk => { error += chunk }); child.stdout.resume()
    child.on("close",code => resolve({code,error}))
    child.stdin.end(`begin; set local role service_role;
      select public.reserve_workspace_ai_run('72000000-0000-4000-8000-00000000001${n}','00000000-0000-0000-0000-000000000004',
      '00000000-0000-0000-0000-00000000000${n}',repeat('a',64),'{}','cap race','{}',20,80000);
      select pg_sleep(0.15); commit;`)
  })
  const capped = await Promise.all([reserveWithCaps(4),reserveWithCaps(2)])
  if (capped.filter(result => result.code === 0).length !== 1 || !capped.some(result => result.error.includes("Organization monthly AI credit limit reached"))) throw new Error(`Concurrent limit admission failed: ${JSON.stringify(capped)}`)
  runSql("supabase/tests/workspace-ai-payment-restrictions.assertions.sql")
  runSql("supabase/tests/workspace-ai-usage.assertions.sql")
  runSql("supabase/tests/workspace-ai-allowances.assertions.sql")
  run("psql",args,{input:`set role service_role; select public.bind_ai_credit_subscription('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000004','test','sub_allowance_four','cus_allowance_four','75000000-0000-4000-8000-000000000004');`})
  const allowanceStart=new Date(Date.now()-86400000).toISOString(), allowanceEnd=new Date(Date.now()+29*86400000).toISOString()
  const grantConcurrently=()=>new Promise(resolve=>{
    const child=spawn(join(postgresDirectory,"psql"),args,{stdio:["pipe","pipe","pipe"]})
    let error="";child.stderr.on("data",chunk=>{error+=chunk});child.stdout.resume()
    child.on("close",code=>resolve({code,error}))
    child.stdin.end(`begin; set local role service_role; select public.grant_ai_credit_allowance('test','sub_allowance_four','cus_allowance_four','monthly-fixture-v1','in_allowance_race','${allowanceStart}','${allowanceEnd}'); select pg_sleep(0.1); commit;`)
  })
  const allowanceRace=await Promise.all([grantConcurrently(),grantConcurrently()])
  if(allowanceRace.some(result=>result.code!==0)) throw new Error(`Allowance race failed: ${JSON.stringify(allowanceRace)}`)
  run("psql",args,{input:`select public.assert_ai((select count(*)=1 from public.ai_credit_allowance_grants where subscription_id='sub_allowance_four'),'concurrent webhook/bind grants once');`})

  console.log("[workspace-ai] Owner/member limits, stale edits, replay, UTC periods and capped concurrency; purchases, plan/application, accounting, cancellation and recovery passed.")
} finally {
  if (started) {
    spawnSync(join(postgresDirectory, "pg_ctl"), [
      "-D", dataDirectory, "-m", "fast", "-w", "stop",
    ])
  }
  rmSync(dataDirectory, { force: true, recursive: true })
}
