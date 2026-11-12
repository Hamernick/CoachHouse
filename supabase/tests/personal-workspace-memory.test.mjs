#!/usr/bin/env node

import { execFileSync, spawnSync, spawn } from "node:child_process"
import { accessSync, constants, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const root = process.cwd()
const postgresDirectory = process.env.POSTGRES_BINDIR?.trim() || resolvePgBin()
const dataDirectory = mkdtempSync(join(tmpdir(), "ch-personal-memory-"))
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

const args = ["-h",socketDirectory,"-p",port,"-U","postgres","-d","postgres","-v","ON_ERROR_STOP=1","-Atq"]
const sql = input => run("psql", args, { input }).stdout.trim()
const id = n => `00000000-0000-0000-0000-${String(n).padStart(12,"0")}`
const actor = n => `set role authenticated; set request.jwt.claim.sub='${id(n)}';`
const call = (org, action="read", revision="null", extra="null,null,null") => `select public.manage_personal_workspace_memory('${id(org)}','${action}',${revision},${extra});`
const read = (who, org) => JSON.parse(sql(actor(who)+call(org)))
let assertions = 0
function assert(value, label) { if (!value) throw Error(label); assertions++ }
function denied(input, label) { let failed = false; try { sql(input) } catch { failed = true } assert(failed,label) }
let started = false
try {
  run("initdb", ["-D",dataDirectory,"-A","trust","-U","postgres"])
  run("pg_ctl",["-D",dataDirectory,"-o",`-F -k ${socketDirectory} -p ${port}`,"-l",join(dataDirectory,"postgres.log"),"-w","start"]);started=true
  runSql("supabase/tests/google-drive-rls.bootstrap.sql")
  runSql("supabase/tests/workspace-ai.bootstrap.sql")
  // Reuse the canonical membership function; closure is a controlled fixture.
  const metering=readFileSync(join(root,"supabase/migrations/20261022120000_workspace_ai_metering.sql"),"utf8")
  sql(metering.slice(metering.indexOf("create function public.can_use_workspace_ai("),metering.indexOf("create function public.reserve_workspace_ai_run(")))
  sql(`create function auth.role() returns text language sql as 'select current_setting(''request.jwt.claim.role'',true)';
    alter database postgres set request.jwt.claim.role='authenticated';
    create table fixture_closure(org_id uuid primary key);
    create function public.guard_organization_closure(org uuid) returns void language plpgsql as $$begin if exists(select 1 from public.fixture_closure where org_id=org) then raise exception 'Closed';end if;end$$;
    create function public.can_read_workspace_ai(org uuid,actor uuid) returns boolean language sql as 'select public.can_use_workspace_ai(org,actor) and not exists(select 1 from public.fixture_closure where org_id=org)';
    insert into public.organization_memberships values('${id(4)}','${id(2)}','staff');`)
  runSql("supabase/migrations/20261111100000_personal_workspace_memory.sql")
  assert(!read(2,1).enabled,"default off")
  assert(sql("select count(*) from public.personal_workspace_memory")==="0","read creates no rows")
  denied(actor(2)+call(1,"save",0,`'${id(10)}','private preference',null`),"off blocks save")
  sql(actor(2)+call(1,"enable",0,"null,null,true"))
  sql(actor(2)+call(1,"save",1,`'${id(10)}','Keep answers concise',null`))
  let state=read(2,1)
  assert(state.entries[0].value==="Keep answers concise" && state.revision===2,"independent connection reload")
  const privateBefore = sql("select row_to_json(p)::text from public.personal_workspace_memory p order by org_id,user_id")
  runSql("supabase/migrations/20261111110000_organization_workspace_memory.sql")
  assert(sql("select row_to_json(p)::text from public.personal_workspace_memory p order by org_id,user_id") === privateBefore,"shared migration preserves exact private data")
  assert(read(1,1).entries.length===0,"owner cannot see member memory")
  assert(read(2,4).entries.length===0,"same actor cannot bleed into another organization")
  denied(actor(3)+call(1),"non-AI member denied")
  denied(actor(2)+"select * from public.personal_workspace_memory","direct read denied")
  denied(actor(2)+"delete from public.personal_workspace_memory","direct delete denied")
  denied("set role anon;"+call(1),"anonymous denied")
  denied("set role service_role;"+call(1),"service cannot impersonate personal actor")
  denied(actor(2)+call(1,"save",1,`'${id(10)}','stale overwrite',null`),"stale correction denied")
  sql(actor(2)+call(1,"save",2,`'${id(10)}','Use plain language',null`))
  state=read(2,1)
  assert(state.entries[0].revision===2 && state.entries[0].value==="Use plain language","correction preserves identity and advances revision")
  sql(actor(2)+call(1,"enable",3,"null,null,false"))
  assert(!read(2,1).enabled && read(2,1).entries.length===1,"off retains entries")
  denied(actor(2)+call(1,"save",4,`'${id(10)}','off write',null`),"off blocks edit")
  sql(actor(2)+call(1,"delete",4,`'${id(10)}',null,null`))
  assert(read(2,1).entries.length===0,"delete while off")
  sql(actor(2)+call(1,"enable",5,"null,null,true"))
  const race=()=>new Promise(resolve=>{const child=spawn(join(postgresDirectory,"psql"),args);let stderr="";child.stderr.on("data",x=>stderr+=x);child.stdout.resume();child.on("close",code=>resolve({code,stderr}));child.stdin.end(actor(2)+call(1,"save",6,`'${id(11)}','Concurrent preference',null`))})
  const outcomes=await Promise.all([race(),race()]);assert(outcomes.filter(x=>x.code===0).length===1,"one concurrent writer wins")
  assert(read(2,1).revision===7,"no duplicate revision/write")
  sql(actor(2)+call(1,"clear",7))
  assert(!read(2,1).enabled && read(2,1).entries.length===0 && read(2,1).revision===8,"clear removes and fences stale drafts")
  denied(actor(2)+call(1,"save",7,`'${id(11)}','resurrected',null`),"clear prevents stale resurrection")
  const sharedCall = (org, action="read", revision="null", extra="null,null,null") => call(org,action,revision,extra).replace("manage_personal_workspace_memory","manage_organization_workspace_memory")
  const sharedRead = (who,org) => JSON.parse(sql(actor(who)+sharedCall(org)))
  const personalBeforeShared = sql("select row_to_json(p)::text from public.personal_workspace_memory p order by org_id,user_id")
  assert(!sharedRead(1,1).enabled && sharedRead(1,1).canManage,"shared defaults off, owner manages")
  assert(!sharedRead(2,1).canManage && sharedRead(2,1).scope==="organization","staff may read, not manage")
  assert(sql("select count(*) from public.organization_workspace_memory")==="0","shared read creates no rows")
  for (const action of ["enable","save","delete","clear"]) denied(actor(2)+sharedCall(1,action,0,`'${id(20)}','unauthorized',true`),"staff denied shared "+action)
  denied(actor(3)+sharedCall(1),"non-AI member denied shared read")
  denied(actor(2)+"select * from public.organization_workspace_memory","shared direct read denied")
  denied(actor(1)+"update public.organization_workspace_memory set enabled=true","shared direct write denied even owner")
  denied("set role anon;"+sharedCall(1),"anonymous shared denied")
  denied("set role service_role;"+sharedCall(1),"service impersonation shared denied")
  denied(actor(1)+sharedCall(1,"save",0,`'${id(20)}','explicit shared guidance',null`),"shared off blocks save")
  sql(actor(1)+sharedCall(1,"enable",0,"null,null,true"))
  sql(actor(1)+sharedCall(1,"save",1,`'${id(20)}','Use our approved terminology',null`))
  let shared=sharedRead(2,1)
  assert(shared.entries[0].value==="Use our approved terminology" && shared.entries[0].createdBy===id(1) && shared.actorId===id(2),"independent member reads explicit owner-authored guidance")
  assert(sharedRead(2,4).entries.length===0,"shared guidance stays in its organization")
  denied(actor(1)+sharedCall(1,"save",1,`'${id(20)}','stale correction',null`),"shared stale correction denied")
  sql(actor(1)+sharedCall(1,"save",2,`'${id(20)}','Corrected terminology',null`))
  assert(sharedRead(2,1).entries[0].revision===2,"shared correction advances revision")
  sql(actor(1)+sharedCall(1,"enable",3,"null,null,false"))
  assert(!sharedRead(2,1).enabled && sharedRead(2,1).entries.length===1,"shared off retains entries")
  denied(actor(1)+sharedCall(1,"save",4,`'${id(20)}','off edit',null`),"shared off blocks edit")
  sql(actor(1)+sharedCall(1,"delete",4,`'${id(20)}',null,null`))
  assert(sharedRead(2,1).entries.length===0,"shared delete while off")
  sql(actor(1)+sharedCall(1,"enable",5,"null,null,true"))
  const sharedRace=()=>new Promise(resolve=>{const child=spawn(join(postgresDirectory,"psql"),args);child.stderr.resume();child.stdout.resume();child.on("close",code=>resolve(code));child.stdin.end(actor(1)+sharedCall(1,"save",6,`'${id(21)}','Concurrent organization guidance',null`))})
  const sharedOutcomes=await Promise.all([sharedRace(),sharedRace()])
  assert(sharedOutcomes.filter(code=>code===0).length===1 && sharedRead(2,1).revision===7,"one shared concurrent writer wins")
  sql(actor(1)+sharedCall(1,"clear",7))
  assert(!sharedRead(2,1).enabled && sharedRead(2,1).entries.length===0 && sharedRead(2,1).revision===8,"shared clear retains revision fence")
  denied(actor(1)+sharedCall(1,"save",7,`'${id(21)}','resurrected shared draft',null`),"shared stale resurrection denied")
  assert(sql("select row_to_json(p)::text from public.personal_workspace_memory p order by org_id,user_id")===personalBeforeShared,"all shared operations preserve exact personal rows")
  sql(`update public.organization_memberships set role='admin' where org_id='${id(1)}' and member_id='${id(2)}'`)
  assert(!sharedRead(2,1).canManage,"admin reads without organization-owner authority")
  denied(actor(2)+sharedCall(1,"enable",8,"null,null,true"),"admin cannot manage owner settings")
  sql(`update public.organization_memberships set role='board' where org_id='${id(1)}' and member_id='${id(2)}'`)
  denied(actor(2)+sharedCall(1),"AI role revocation denies shared reads")
  sql(`update public.organization_memberships set role='staff' where org_id='${id(1)}' and member_id='${id(2)}'`)
  sql("delete from public.organization_memberships where org_id='"+id(1)+"' and member_id='"+id(2)+"'")
  denied(actor(2)+call(1),"revocation denies future reads")
  denied(actor(2)+sharedCall(1),"membership revocation denies shared reads")
  assert(read(2,4).entries.length===0,"independent membership preserved")
  sql(`insert into fixture_closure values('${id(4)}')`)
  denied(actor(2)+call(4,"enable",0,"null,null,true"),"closed organization denies writes")
  denied(actor(4)+sharedCall(4,"enable",0,"null,null,true"),"closed organization denies shared owner writes")
  assert(sql("select relrowsecurity and relforcerowsecurity from pg_class where oid='public.organization_workspace_memory'::regclass")==="t","shared RLS forced")
  assert(sql("select relrowsecurity and relforcerowsecurity from pg_class where oid='public.personal_workspace_memory'::regclass")==="t","RLS forced")
  console.log(`personal-and-organization-memory: ${assertions} disposable PostgreSQL assertions passed; canonical membership authority, controlled closure fixture; no hosted changes`)
} finally {
  if(started) spawnSync(join(postgresDirectory,"pg_ctl"),["-D",dataDirectory,"-m","fast","-w","stop"],{stdio:"ignore"})
  rmSync(dataDirectory,{force:true,recursive:true})
}

