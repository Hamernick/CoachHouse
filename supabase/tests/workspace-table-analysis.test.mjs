#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
const bin=execFileSync("pg_config",["--bindir"],{encoding:"utf8"}).trim()
const dir=mkdtempSync(join(tmpdir(),"ch-table-analysis-")),port=String(58000+process.pid%1000)
const env={...process.env,LC_ALL:"C",PGOPTIONS:"-c statement_timeout=10000 -c coach_house.workspace_sharing_fixture=isolated-test-only"}
const run=(name,args,input)=>{const r=spawnSync(join(bin,name),args,{encoding:"utf8",input,env,maxBuffer:32*1024*1024});if(r.status!==0)throw Error(r.stderr||r.stdout);return r.stdout.trim()}
const db="workspace_sharing_fixture_table_analysis",url=`postgresql://postgres@localhost:${port}/${db}`
let started=false
try {
 run("initdb",["-D",dir,"-A","trust","-U","postgres"])
 run("pg_ctl",["-D",dir,"-o",`-F -k /tmp -p ${port}`,"-l",join(dir,"postgres.log"),"-w","start"]);started=true
 run("createdb",["-h","localhost","-p",port,"-U","postgres",db])
 const args=["-XqAt","-v","ON_ERROR_STOP=1","-d",url]
 run("psql",[...args,"-f",resolve("supabase/tests/workspace-data-views-fixture.sql")])
 const before=run("psql",args,"select pg_get_functiondef('public.workspace_data_view_command(jsonb)'::regprocedure);")
 run("psql",[...args,"-f",resolve("supabase/migrations/20261111150000_workspace_table_analysis_snapshot.sql")])
 if(run("psql",args,"select pg_get_functiondef('public.workspace_data_view_command(jsonb)'::regprocedure);")!==before)throw Error("Existing reader changed")
 const test=spawnSync("pnpm",["exec","vitest","run","--no-file-parallelism","tests/acceptance/workspace-table-analysis.test.ts"],{encoding:"utf8",env:{...env,TABLE_ANALYSIS_DATABASE_URL:url,ORGANIZATION_CLOSURE_TEST_DATABASE_URL:url},maxBuffer:32*1024*1024})
 process.stdout.write(test.stdout);process.stderr.write(test.stderr)
 if(test.status!==0)throw Error("Table analysis qualification failed")
 console.log(JSON.stringify({nativeOwnerUnchanged:true,applicationExitCode:0}))
 if(process.env.TABLE_ANALYSIS_RECEIPT)writeFileSync(process.env.TABLE_ANALYSIS_RECEIPT,JSON.stringify({nativeOwnerUnchanged:true,applicationExitCode:0,database:"disposable local PostgreSQL",hostedWrites:false},null,2))
} finally {
 if(started)run("pg_ctl",["-D",dir,"-m","immediate","-w","stop"])
 rmSync(dir,{recursive:true,force:true})
}
